import { describe, expect, mock, test } from "bun:test";
import { bulkInsertData, mapFromPrismaValue, mapToPrismaValue, parseBigIntValue, prisma } from "../../src/utils/database";
import { Tables } from "../../src/types/database";

describe("database conversion helpers", () => {
    test("preserves values above Number.MAX_SAFE_INTEGER exactly", () => {
        const unsafeValue = "90071992547409931234";
        const prismaValue = mapToPrismaValue("score", unsafeValue);
        expect(prismaValue).toBe(90071992547409931234n);

        const mapped = mapFromPrismaValue({ id: 90071992547409931234n, score: 90071992547409931234n });
        expect(mapped).toEqual({ id: unsafeValue, score: unsafeValue });
    });

    test("rejects malformed bigint values instead of partially parsing them", () => {
        expect(() => parseBigIntValue("123abc", "score")).toThrow("decimal integer");
        expect(() => mapToPrismaValue("score", 9007199254740992)).toThrow("safe integer");
    });

    test("maps guild join timestamps to Prisma dates and back to millisecond strings", () => {
        const timestamp = 1754494897113;
        const prismaValue = mapToPrismaValue("joined_at", timestamp);

        expect(prismaValue).toEqual(new Date(timestamp));
        expect(mapFromPrismaValue({ joined_at: prismaValue })).toEqual({ joined_at: String(timestamp) });
    });

    test("accepts ISO guild join timestamps", () => {
        const date = new Date("2025-08-06T12:00:00.000Z");

        expect(mapToPrismaValue("joined_at", date.toISOString())).toEqual(date);
    });

    test("parses deterministic prefix arrays and rejects malformed prefix JSON", () => {
        expect(mapFromPrismaValue({ id: "guild", prefixes: '["!","?"]' })).toEqual({ id: "guild", prefixes: ["!", "?"] });
        expect(() => mapFromPrismaValue({ id: "guild", prefixes: '{"bad":true}' })).toThrow("JSON array of strings");
    });
});

describe("bulkInsertData", () => {
    test("writes entries sequentially through one transaction while preserving mappings", async () => {
        const events: Array<string> = [];
        let releaseFirstWrite: (() => void) | undefined;
        const firstWrite = new Promise<void>((resolve) => {
            releaseFirstWrite = resolve;
        });
        const createMany = mock(async () => {
            events.push("first:start");
            await firstWrite;
            events.push("first:end");
        });
        const upsert = mock(async () => {
            events.push("second");
        });
        const transactionClient = {
            score: { createMany, upsert },
        };
        const transaction = mock(async (callback: (client: typeof transactionClient) => Promise<unknown>) => callback(transactionClient));
        const originalTransaction = prisma.$transaction;
        Reflect.set(prisma, "$transaction", transaction);

        try {
            const batch = bulkInsertData([
                {
                    table: Tables.SCORE,
                    id: "90071992547409931234",
                    ignore: true,
                    data: [
                        { key: "user_id", value: "123" },
                        { key: "map_id", value: 456 },
                        { key: "score", value: "789" },
                    ],
                },
                {
                    table: Tables.SCORE,
                    id: 24,
                    data: [
                        { key: "user_id", value: 456 },
                        { key: "map_id", value: "789" },
                        { key: "score", value: 1000 },
                    ],
                },
            ]);

            await Promise.resolve();
            expect(transaction).toHaveBeenCalledTimes(1);
            expect(events).toEqual(["first:start"]);
            expect(upsert).not.toHaveBeenCalled();

            releaseFirstWrite?.();
            await batch;

            expect(events).toEqual(["first:start", "first:end", "second"]);
            expect(createMany).toHaveBeenCalledWith({
                data: { id: 90071992547409931234n, user_id: 123n, map_id: 456n, score: 789n },
                skipDuplicates: true,
            });
            expect(upsert).toHaveBeenCalledWith({
                where: { id: 24n },
                create: { id: 24n, user_id: 456n, map_id: 789n, score: 1000n },
                update: { user_id: 456n, map_id: 789n, score: 1000n },
            });
        } finally {
            Reflect.set(prisma, "$transaction", originalTransaction);
        }
    });

    test("rejects and rolls back the transaction when an entry write fails", async () => {
        const writeFailure = new Error("write failed");
        const createMany = mock(() => Promise.reject(writeFailure));
        const upsert = mock(() => Promise.resolve());
        const transactionClient = {
            map: { createMany, upsert },
        };
        let committed = false;
        let rolledBack = false;
        const transaction = mock(async (callback: (client: typeof transactionClient) => Promise<unknown>) => {
            try {
                const result = await callback(transactionClient);
                committed = true;
                return result;
            } catch (error) {
                rolledBack = true;
                throw error;
            }
        });
        const originalTransaction = prisma.$transaction;
        Reflect.set(prisma, "$transaction", transaction);

        try {
            await expect(
                bulkInsertData([
                    { table: Tables.MAP, id: 1, ignore: true, data: [{ key: "data", value: "first" }] },
                    { table: Tables.MAP, id: 2, data: [{ key: "data", value: "second" }] },
                ]),
            ).rejects.toThrow(writeFailure);

            expect(transaction).toHaveBeenCalledTimes(1);
            expect(createMany).toHaveBeenCalledTimes(1);
            expect(upsert).not.toHaveBeenCalled();
            expect(committed).toBe(false);
            expect(rolledBack).toBe(true);
        } finally {
            Reflect.set(prisma, "$transaction", originalTransaction);
        }
    });
});
