import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import { EmbedBuilderType } from "../../../src/types/builders";
import { Mode } from "../../../src/types/osu";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";
import type { CommandData } from "../../../src/types/commands";

interface ReplyPayload {
    embeds: Array<{ title?: string; description?: string }>;
    components?: unknown;
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
}));

mock.module("@utils/score-api", () => ({
    USER_SCORE_FETCH_LIMIT: 200,
}));

const getFetchedPlayReplyMock = mock(({ user, titleFilter }: { user: { banchoId: string }; titleFilter?: string }) =>
    Promise.resolve(
        user.banchoId === "missing"
            ? {
                  reply: {
                      embeds: [{ title: "Uh oh! :x:", description: "It seems like `missing` doesn't exist :(" }],
                  },
              }
            : {
                  reply: {
                      embeds: [{ title: "top play", author: { name: "mrekk" } }],
                      components: [],
                  },
                  embedOptions: {
                      type: EmbedBuilderType.PLAYS,
                      initiatorId: "123",
                      plays: [],
                      user: { id: 1, username: user.banchoId },
                      mode: Mode.OSU,
                      authorDb: null,
                      page: 0,
                      isPage: true,
                      titleFilter,
                  },
              },
    ),
);

mock.module("@services/play-service", () => ({
    getFetchedPlayReply: getFetchedPlayReplyMock,
}));

const { run, data: topData } = await import("../../../src/commands/osu/top");
const { data: recentData } = await import("../../../src/commands/osu/recent");
const { data: recentBestData } = await import("../../../src/commands/osu/recentbest");
const { data: recentListData } = await import("../../../src/commands/osu/recentlist");

function getApplicationOptions(commandData: CommandData): Array<{ name: string; max_value?: number }> {
    expect(commandData.application?.options).toBeDefined();
    return commandData.application?.options as Array<{ name: string; max_value?: number }>;
}

function getPageMaxValue(commandData: CommandData): number | undefined {
    return getApplicationOptions(commandData).find((option) => option.name === "page")?.max_value;
}

function hasFilterOption(commandData: CommandData): boolean {
    return getApplicationOptions(commandData).some((option) => option.name === "filter");
}

describe("top command", () => {
    test("allows selecting pages for all fetched top plays", () => {
        expect(getPageMaxValue(topData)).toBe(40);
        expect(getPageMaxValue(recentBestData)).toBe(40);
        expect(getPageMaxValue(recentListData)).toBe(40);
    });

    test("exposes title filter option on fetched play commands", () => {
        expect(hasFilterOption(topData)).toBe(true);
        expect(hasFilterOption(recentData)).toBe(true);
        expect(hasFilterOption(recentBestData)).toBe(true);
        expect(hasFilterOption(recentListData)).toBe(true);
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

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk"], "!", "top");
        ctx.defer = mock(() => Promise.resolve());
        getFetchedPlayReplyMock.mockClear();

        await run(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        expect(getFetchedPlayReplyMock).toHaveBeenCalled();
        expect(reply).toHaveBeenCalled();
        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("top play");
        expect(replyCall.components).toBeDefined();
    });

    test("passes prefix title filters to the plays builder", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        getFetchedPlayReplyMock.mockClear();

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk", 'filter="Yami', "no", 'Uta"'], "!", "top");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(getFetchedPlayReplyMock).toHaveBeenCalled();
        const [serviceOptions] = getFetchedPlayReplyMock.mock.calls[0] as Array<{ titleFilter?: string }>;
        expect(serviceOptions.titleFilter).toBe("Yami no Uta");
    });

    test("rejects invalid prefix page flags before calling the builder", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: string | ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        getFetchedPlayReplyMock.mockClear();

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["mrekk", "p=abc"], "!", "top");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(getFetchedPlayReplyMock).not.toHaveBeenCalled();
        expect(reply).toHaveBeenCalledWith("page must be a whole number.");
    });

    test("returns a generic not found embed for a missing user", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["missing"], "!", "top");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("Uh oh! :x:");
        expect(replyCall.embeds[0].description).toContain("doesn't exist");
    });
});
