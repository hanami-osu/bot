import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";

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
    v2: {
        users: {
            details: mock(({ user }: { user: string }) =>
                user === "missing" ? Promise.resolve({ error: { message: "not found" } }) : Promise.resolve({ id: 1, username: user, statistics: {}, country: {}, cover: {} }),
            ),
        },
    },
}));

mock.module("@utils/score-api", () => ({
    getUserScores: mock(() => Promise.resolve([{ id: 1, mods: [], statistics: {}, beatmap: { id: 1 }, beatmapset: {}, passed: true }])),
}));

mock.module("@builders", () => ({
    playBuilder: mock(() => Promise.resolve([{ title: "recent play", author: { name: "mrekk" } }])),
    simulateBuilder: mock(() => Promise.resolve([{ title: "simulated" }])),
}));

const { run } = await import("../../../src/commands/osu/recent");

describe("recent command", () => {
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

        await run(ctx);

        expect(ctx.defer).toHaveBeenCalled();
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

        await run(ctx);

        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("Uh oh! :x:");
        expect(replyCall.embeds[0].description).toContain("doesn't exist");
    });
});
