import { describe, expect, test } from "bun:test";
import { mapFromPrismaValue, mapToPrismaValue, parseBigIntValue } from "../../src/utils/database";

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

    test("parses deterministic prefix arrays and rejects malformed prefix JSON", () => {
        expect(mapFromPrismaValue({ id: "guild", prefixes: '["!","?"]' })).toEqual({ id: "guild", prefixes: ["!", "?"] });
        expect(() => mapFromPrismaValue({ id: "guild", prefixes: '{"bad":true}' })).toThrow("JSON array of strings");
    });
});
