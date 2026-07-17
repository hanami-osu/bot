import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import { EmbedBuilderType } from "../../../src/types/builders";
import { Mode } from "../../../src/types/osu";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";

interface ReplyPayload {
    embeds: Array<{ title?: string; description?: string }>;
    components?: unknown;
}

let authorMode: Mode | null = null;

function parseMockBigInt(value: string | number | bigint, fieldName = "value"): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error(`${fieldName} must be a safe integer or decimal string`);
    if (typeof value === "string" && !/^-?\d+$/.test(value)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(value);
}

mock.module("@utils/database", () => ({
    getEntry: mock((table: Tables, id: string) =>
        Promise.resolve(table === Tables.USER && id === "123" ? { id, banchoId: null, mode: authorMode } : null),
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
}));

mock.module("@utils/score-api", () => ({
    USER_SCORE_FETCH_LIMIT: 200,
}));

const getFetchedPlayReplyMock = mock(
    ({ user }: { user: { banchoId: string; mode: Mode }; includeFails?: boolean; emptyMessage?: (username: string) => string }) =>
        Promise.resolve(
            user.banchoId === "missing"
                ? {
                      reply: {
                          embeds: [{ title: "Uh oh! :x:", description: "It seems like `missing` doesn't exist :(" }],
                      },
                  }
                : {
                      reply: {
                          embeds: [{ title: "recent play", author: { name: "mrekk" } }],
                          components: [],
                      },
                      embedOptions: {
                          type: EmbedBuilderType.PLAYS,
                          initiatorId: "123",
                          plays: [],
                          user: { id: 1, username: user.banchoId },
                          mode: Mode.OSU,
                          authorDb: null,
                          index: 0,
                          isPage: false,
                      },
                  },
        ),
);

mock.module("@services/play-service", () => ({
    getFetchedPlayReply: getFetchedPlayReplyMock,
}));

const { run } = await import("../../../src/commands/osu/recent");

describe("recent command", () => {
    beforeEach(() => {
        authorMode = null;
        getFetchedPlayReplyMock.mockClear();
    });

    test("runs with mocked osu data and returns paginated embeds", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "recent");
        ctx.defer = mock(() => Promise.resolve());
        getFetchedPlayReplyMock.mockClear();

        await run(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        expect(getFetchedPlayReplyMock).toHaveBeenCalled();
        expect(reply).toHaveBeenCalled();
        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("recent play");
        expect(replyCall.components).toBeDefined();
    });

    test("returns a not found embed for a missing user", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["missing"], "!", "recent");
        ctx.defer = mock(() => Promise.resolve());
        getFetchedPlayReplyMock.mockClear();

        await run(ctx);

        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("Uh oh! :x:");
        expect(replyCall.embeds[0].description).toContain("doesn't exist");
    });

    test("neutral prefix aliases use saved mode and preserve include-fails behavior", async () => {
        authorMode = Mode.MANIA;
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "rs");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const [serviceOptions] = getFetchedPlayReplyMock.mock.calls[0] as Array<{ user: { mode: Mode }; includeFails?: boolean }>;
        expect(serviceOptions.user.mode).toBe(Mode.MANIA);
        expect(serviceOptions.includeFails).toBe(true);
    });

    test("neutral pass aliases use saved mode and preserve pass-only behavior", async () => {
        authorMode = Mode.MANIA;
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "rsp");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const [serviceOptions] = getFetchedPlayReplyMock.mock.calls[0] as Array<{ user: { mode: Mode }; includeFails?: boolean }>;
        expect(serviceOptions.user.mode).toBe(Mode.MANIA);
        expect(serviceOptions.includeFails).toBe(false);
    });

    test("mode-specific prefix aliases override saved mode", async () => {
        authorMode = Mode.MANIA;
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "rt");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const [serviceOptions] = getFetchedPlayReplyMock.mock.calls[0] as Array<{ user: { mode: Mode }; includeFails?: boolean }>;
        expect(serviceOptions.user.mode).toBe(Mode.TAIKO);
        expect(serviceOptions.includeFails).toBe(true);
    });

    test("empty recent-play message includes the resolved mode", async () => {
        authorMode = Mode.MANIA;
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "recent");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const [serviceOptions] = getFetchedPlayReplyMock.mock.calls[0] as Array<{ emptyMessage?: (username: string) => string }>;
        expect(serviceOptions.emptyMessage?.("yorunoken")).toBe("It seems like `yorunoken` hasn't set any recent plays in `mania`! :(");
    });
});
