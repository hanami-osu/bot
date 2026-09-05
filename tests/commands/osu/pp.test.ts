import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";
import { EMBED_COLORS } from "../../../src/embed-builders/common";

interface ReplyPayload {
    embeds: Array<{
        author?: { name?: string };
        description?: string;
        fields?: Array<{ name: string; value: string }>;
    }>;
}

function parseMockBigInt(value: string | number | bigint, fieldName = "value"): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && !Number.isSafeInteger(value))
        throw new Error(`${fieldName} must be a safe integer or decimal string`);
    if (typeof value === "string" && !/^-?\d+$/.test(value)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(value);
}

mock.module("@utils/database", () => ({
    prisma: {},
    getEntry: mock((table: Tables, id: string) =>
        Promise.resolve(table === Tables.USER && id === "123" ? { id, banchoId: null } : null),
    ),
    insertData: mock(() => Promise.resolve()),
    bulkInsertData: mock(() => Promise.resolve()),
    removeEntry: mock(() => Promise.resolve(true)),
    getRowCount: mock(() => Promise.resolve(0)),
    getRowSum: mock(() => Promise.resolve(0)),
    parseBigIntValue: parseMockBigInt,
    mapToPrismaValue: (key: string, value: unknown) =>
        ["joined_at", "user_id", "map_id", "score"].includes(key) ? parseMockBigInt(value as string | number | bigint, key) : value,
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

const { run, data } = await import("../../../src/commands/osu/pp");

describe("pp command", () => {
    test("includes short prefix aliases for non-osu modes", () => {
        expect(data.message.aliases).toContain("ppt");
        expect(data.message.aliases).toContain("ppm");
        expect(data.message.aliases).toContain("ppc");
    });

    test("calculates required play pp from a target and count", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["1400", "plays=1", "mrekk"], "!", "pp");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        expect(reply).toHaveBeenCalled();
        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].author?.name).toContain("mrekk");
        expect(replyCall.embeds[0].description).toContain("To reach **1,400.00pp**");
        expect(replyCall.embeds[0].description).toContain("**1** play");
        expect(replyCall.embeds[0].fields?.[0]?.value).toContain("1,");
        expect(getUserScoresMock.mock.calls[0]?.[2]).toEqual({ query: { mode: "osu", limit: 200 } });
    });

    test("calculates required count from a target and play pp", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["1500", "450pp", "mrekk"], "!", "pp");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].description).toContain("worth **450.00pp** each");
        expect(replyCall.embeds[0].description).toContain("plays");
    });

    test("returns a validation message when both play pp and play count are provided", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_content: string | ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["1500", "450pp", "plays=2", "mrekk"], "!", "pp");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(reply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Check your input",
                    color: EMBED_COLORS.error,
                    description: expect.stringContaining("Provide either a play pp value or a play count, not both."),
                }),
            ],
        });
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
            ["pp", "osu"],
            ["ppt", "taiko"],
            ["ppm", "mania"],
            ["ppc", "fruits"],
        ] as const;

        for (const [commandName, mode] of modeCases) {
            const callCount = getUserScoresMock.mock.calls.length;
            const ctx = new CommandContext(mockClient, undefined, mockMessage, ["1400", "mrekk"], "!", commandName);
            ctx.defer = mock(() => Promise.resolve());

            await run(ctx);

            expect(getUserScoresMock.mock.calls[callCount]?.[2]).toEqual({ query: { mode, limit: 200 } });
        }
    });
});
