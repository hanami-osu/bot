import { expect, test, describe, mock } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { EMBED_COLORS } from "../../../src/embed-builders/common";

mock.module("osu-api-extended", () => ({
    v2: {
        users: {
            details: mock(() => Promise.resolve({ id: 17279598 })),
        },
    },
}));

const { run } = await import("../../../src/commands/general/ping");

describe("ping command", () => {
    test("runs and returns correct latency information for message", async () => {
        const mockClient = {
            ping: mock(() => Promise.resolve({ ws: 42, rest: 50 })),
        } as any;

        const mockMessage = {
            author: { id: "123", username: "test_user" },
            channelId: "channel123",
            reply: mock(() => Promise.resolve({ edit: mock(() => Promise.resolve()) })),
        } as any;

        const ctx = new CommandContext(mockClient, undefined, mockMessage, [], "!", "ping");

        // Mock the defer function to avoid throwing errors during tests
        ctx.defer = mock(() => Promise.resolve());

        await run(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        expect(mockMessage.reply).toHaveBeenCalled();

        const replyCall = mockMessage.reply.mock.calls[0][0];
        expect(replyCall.content).toBe("🏓 Checking latency...");

        // After osu API resolves, we expect an edit on the sent message
        const sentMessage = await mockMessage.reply.mock.results[0].value;
        expect(sentMessage.edit).toHaveBeenCalled();

        const editCall = sentMessage.edit.mock.calls[0][0];
        expect(editCall.embeds[0]).toMatchObject({ title: "Pong! 🏓", color: EMBED_COLORS.brand });
        expect(editCall.embeds[0].description).toContain("Discord WebSocket:** `42ms`");
        expect(editCall.embeds[0].description).toContain("Discord REST:** `50ms`");
        expect(editCall.embeds[0].description).toContain("osu! API:");
    });

    test("runs and returns correct latency information for interaction", async () => {
        const mockClient = {
            ping: mock(() => Promise.resolve({ ws: 10, rest: 15 })),
        } as any;

        const mockInteraction = {
            member: { user: { id: "123", username: "test_user" } },
            channelId: "channel123",
            deferReply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;

        const ctx = new CommandContext(mockClient, mockInteraction, undefined, [], undefined, "ping");

        await run(ctx);

        expect(mockInteraction.deferReply).toHaveBeenCalled();
        expect(mockInteraction.editReply).toHaveBeenCalled();

        const editCall = mockInteraction.editReply.mock.calls[0][0];
        expect(editCall.embeds[0]).toMatchObject({ title: "Pong! 🏓", color: EMBED_COLORS.brand });
        expect(editCall.embeds[0].description).toContain("Discord WebSocket:** `10ms`");
        expect(editCall.embeds[0].description).toContain("Discord REST:** `15ms`");
        expect(editCall.embeds[0].description).toContain("osu! API:");
    });
});
