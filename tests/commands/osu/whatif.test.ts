import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";

interface ReplyPayload {
    embeds: Array<{
        author?: { name?: string };
        description?: string;
        fields?: Array<{ name: string; value: string }>;
    }>;
}

function parseMockBigInt(value: string | number | bigint, fieldName = "value"): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error(`${fieldName} must be a safe integer or decimal string`);
    if (typeof value === "string" && !/^-?\d+$/.test(value)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(value);
}

mock.module("@utils/database", () => ({
    getEntry: mock((table: Tables, id: string) => Promise.resolve(table === Tables.USER && id === "123" ? { id, banchoId: null } : null)),
    insertData: mock(() => Promise.resolve()),
    bulkInsertData: mock(() => Promise.resolve()),
    removeEntry: mock(() => Promise.resolve(true)),
    getRowCount: mock(() => Promise.resolve(0)),
    getRowSum: mock(() => Promise.resolve(0)),
    parseBigIntValue: parseMockBigInt,
    mapToPrismaValue: (key: string, value: unknown) => (["joined_at", "user_id", "map_id", "score"].includes(key) ? parseMockBigInt(value as string | number | bigint, key) : value),
    mapFromPrismaValue: (value: unknown) => value,
    incrementCommandCount: mock(() => Promise.resolve()),
}));

mock.module("osu-api-extended", () => ({
    enums: {
        ModsEnum: { HD: 8, HR: 16, DT: 64, NC: 512 },
    },
    v2: {
        users: {
            details: mock(({ user }: { user: string }) =>
                Promise.resolve({
                    id: 1,
                    username: user,
                    avatar_url: "https://a.ppy.sh/1",
                    country_code: "US",
                    statistics: {
                        pp: 1000,
                        global_rank: 10,
                    },
                }),
            ),
        },
    },
}));

const getUserScoresMock = mock((_userId: number, _type: unknown, _options: unknown, _authorDb: unknown) =>
    Promise.resolve([
        { id: 1, pp: 500 },
        { id: 2, pp: 400 },
    ]),
);

mock.module("@utils/score-api", () => ({
    USER_SCORE_FETCH_LIMIT: 200,
    getUserScores: getUserScoresMock,
}));

const { run, data } = await import("../../../src/commands/osu/whatif");

describe("whatif command", () => {
    test("includes short prefix aliases for all modes", () => {
        expect(data.message.aliases).toContain("wi");
        expect(data.message.aliases).toContain("wit");
        expect(data.message.aliases).toContain("wim");
        expect(data.message.aliases).toContain("wic");
    });

    test("projects pp and rank from prefix pp values", async () => {
        const originalApiKey = process.env.OSU_DAILY_API;
        const originalFetch = globalThis.fetch;
        process.env.OSU_DAILY_API = "daily-key";
        globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({ rank: "2", pp: "1408.1" })))) as unknown as typeof fetch;

        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["450pp", "mrekk"], "!", "whatif");
        ctx.defer = mock(() => Promise.resolve());

        try {
            await run(ctx);

            expect(ctx.defer).toHaveBeenCalled();
            expect(reply).toHaveBeenCalled();
            const replyCall = reply.mock.calls[0]?.[0];
            if (!replyCall) throw new Error("Expected reply payload");
            expect(replyCall.embeds[0].author?.name).toContain("mrekk");
            expect(replyCall.embeds[0].description).toContain("1,408.50pp");
            expect(replyCall.embeds[0].description).toContain("#2");
            expect(replyCall.embeds[0].fields?.[0]?.value).toContain("+`408.50pp`");
            expect(getUserScoresMock.mock.calls[0]?.[2]).toEqual({ query: { mode: "osu", limit: 200 } });
        } finally {
            globalThis.fetch = originalFetch;
            if (typeof originalApiKey === "undefined") Reflect.deleteProperty(process.env, "OSU_DAILY_API");
            else process.env.OSU_DAILY_API = originalApiKey;
        }
    });

    test("routes short mode aliases to the matching osu mode", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const modeCases = [
            ["wi", "osu"],
            ["wit", "taiko"],
            ["wim", "mania"],
            ["wic", "fruits"],
        ] as const;

        for (const [commandName, mode] of modeCases) {
            const callCount = getUserScoresMock.mock.calls.length;
            const ctx = new CommandContext(mockClient, undefined, mockMessage, ["450pp", "mrekk"], "!", commandName);
            ctx.defer = mock(() => Promise.resolve());

            await run(ctx);

            expect(getUserScoresMock.mock.calls[callCount]?.[2]).toEqual({ query: { mode, limit: 200 } });
        }
    });
});
