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
        ModsEnum: {},
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

mock.module("@utils/score-api", () => ({
    getUserScores: mock(() =>
        Promise.resolve([
            { id: 1, pp: 500 },
            { id: 2, pp: 400 },
        ]),
    ),
}));

const { run } = await import("../../../src/commands/osu/whatif");

describe("whatif command", () => {
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
        } finally {
            globalThis.fetch = originalFetch;
            if (typeof originalApiKey === "undefined") Reflect.deleteProperty(process.env, "OSU_DAILY_API");
            else process.env.OSU_DAILY_API = originalApiKey;
        }
    });
});
