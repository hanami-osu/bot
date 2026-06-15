import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables } from "../../../src/types/database";
import type { Client } from "lilybird";
import type { Message } from "@lilybird/transformers";

const simulateBuilderMock = mock(() => Promise.resolve([{ title: "simulated" }]));
interface ReplyPayload {
    embeds: Array<{ title?: string; description?: string }>;
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

mock.module("@builders", () => ({
    simulateBuilder: simulateBuilderMock,
}));
mock.module("../../../src/embed-builders/index.ts", () => ({
    simulateBuilder: simulateBuilderMock,
}));
mock.module("../../../src/embed-builders/simulate.ts", () => ({
    simulateBuilder: simulateBuilderMock,
}));

mock.module("@utils/osu", () => ({
    getBeatmapIdFromContext: mock(() => Promise.resolve(72727)),
    accuracyCalculator: mock(() => 100),
    downloadBeatmap: mock(() => Promise.resolve({ id: 72727, contents: "osu file format v14\n[Metadata]\n[HitObjects]" })),
    formatDuration: mock(() => "1:00"),
    getPerformanceResults: mock(() => Promise.resolve(null)),
    gradeCalculator: mock(() => "SS"),
    hitValueCalculator: mock(() => "1/0/0/0"),
    getBeatmapTopScores: mock(() => Promise.resolve([])),
    getRetryCount: mock(() => 1),
    saveScoreDatas: mock(() => Promise.resolve()),
    isPlausibleBeatmap: mock(() => true),
}));

const { run } = await import("../../../src/commands/osu/simulate");

describe("simulate command", () => {
    test("passes validated prefix inputs through the builder contract", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["https://osu.ppy.sh/b/72727", "+HDHR", "combo=1234", "acc=98.5"], "!", "simulate");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(simulateBuilderMock).toHaveBeenCalledWith({
            type: "simulateBuilder",
            initiatorId: "123",
            beatmapId: 72727,
            mods: ["HD", "HR"],
            options: { combo: 1234, acc: 98.5, clock_rate: undefined, bpm: undefined },
        });
    });

    test("returns a validation error for invalid numeric input", async () => {
        const mockClient = { rest: {} } as unknown as Client;
        const reply = mock((_options: ReplyPayload) => Promise.resolve({ edit: mock(() => Promise.resolve({})) }));
        const mockMessage = {
            author: { id: "123", username: "test_user" },
            guildId: "guild",
            channelId: "channel123",
            reply,
        } as unknown as Message;
        const ctx = new CommandContext(mockClient, undefined, mockMessage, ["combo=1.5"], "!", "simulate");
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        const replyCall = reply.mock.calls[0]?.[0];
        if (!replyCall) throw new Error("Expected reply payload");
        expect(replyCall.embeds[0].title).toBe("Invalid simulation input");
        expect(replyCall.embeds[0].description).toContain("combo");
    });
});
