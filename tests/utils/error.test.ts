import { expect, test, describe, mock, beforeEach, afterEach } from "bun:test";
import { handleCommandError } from "../../src/utils/error";
import { logger } from "../../src/utils/logger";
import { EMBED_COLORS } from "../../src/embed-builders/common";

// Mock logger
mock.module("../../src/utils/logger", () => {
    return {
        logger: {
            error: mock(() => Promise.resolve()),
            info: mock(() => Promise.resolve()),
            warn: mock(() => Promise.resolve()),
        },
    };
});

describe("handleCommandError", () => {
    let mockClient: any;
    let mockInteraction: any;
    let mockMessage: any;

    beforeEach(() => {
        process.env.ERROR_CHANNEL_ID = "123456789";
        process.env.OWNER_ID = "987654321";

        mockClient = {
            rest: {
                getGuild: mock(() => Promise.resolve({ name: "Test Guild" })),
                createMessage: mock(() => Promise.resolve()),
            },
        };

        mockInteraction = {
            reply: mock(() => Promise.resolve()),
            guildId: "guild123",
            channelId: "channel123",
            member: {
                user: { id: "user123", username: "testuser" },
            },
        };

        mockMessage = {
            reply: mock(() => Promise.resolve()),
            guildId: "guild456",
            channelId: "channel456",
            author: { id: "user456", username: "testuser2" },
        };

        // Reset the mock implementations between tests
        (logger.error as ReturnType<typeof mock>).mockClear();
    });

    afterEach(() => {
        process.env.ERROR_CHANNEL_ID = "";
        process.env.OWNER_ID = "";
    });

    test("handles interaction error and sends log", async () => {
        const error = new Error("Test interaction error");
        error.stack = "Error: Test interaction error\n    at trace1";

        await handleCommandError(error, {
            client: mockClient,
            interaction: mockInteraction,
            commandName: "ping",
            subCommand: "pong",
        });

        // Verifies interaction reply
        expect(mockInteraction.reply).toHaveBeenCalled();
        const replyCall = mockInteraction.reply.mock.calls[0][0];
        expect(replyCall.ephemeral).toBe(true);
        expect(replyCall.embeds[0]).toMatchObject({
            title: "Something went wrong",
            color: EMBED_COLORS.error,
        });
        expect(replyCall.embeds[0].description).not.toContain("Test interaction error");

        // Verifies discord channel logging
        expect(mockClient.rest.createMessage).toHaveBeenCalled();
        const createMessageArgs = mockClient.rest.createMessage.mock.calls[0];
        expect(createMessageArgs[0]).toBe("123456789");
        expect(createMessageArgs[1].content).toContain("<@987654321>");
        expect(createMessageArgs[1].embeds[0].title).toBe("Runtime error on command (slash): ping -> pong");

        // Verifies file logging
        expect(logger.error).toHaveBeenCalled();
    });

    test("uses command context for interaction error replies after defer", async () => {
        const error = new Error("Test deferred interaction error");
        const commandContext = {
            reply: mock(() => Promise.resolve()),
        };

        await handleCommandError(error, {
            client: mockClient,
            commandContext,
            interaction: mockInteraction,
            commandName: "ping",
        });

        expect(commandContext.reply).toHaveBeenCalledWith({
            ephemeral: true,
            embeds: [
                expect.objectContaining({
                    title: "Something went wrong",
                    color: EMBED_COLORS.error,
                }),
            ],
        });
        expect(mockInteraction.reply).not.toHaveBeenCalled();
        expect(mockClient.rest.createMessage).toHaveBeenCalled();
    });

    test("handles message command error and sends log", async () => {
        const error = new Error("Test message error");
        error.stack = "Error: Test message error\n    at trace2";

        await handleCommandError(error, {
            client: mockClient,
            message: mockMessage,
            commandName: "top",
            content: ";top yorunoken",
            prefix: ";",
        });

        // Verifies message reply
        expect(mockMessage.reply).toHaveBeenCalled();
        const replyCall = mockMessage.reply.mock.calls[0][0];
        expect(replyCall.embeds[0]).toMatchObject({
            title: "Something went wrong",
            color: EMBED_COLORS.error,
        });
        expect(replyCall.embeds[0].description).not.toContain("Test message error");

        // Verifies discord channel logging
        expect(mockClient.rest.createMessage).toHaveBeenCalled();
        const createMessageArgs = mockClient.rest.createMessage.mock.calls[0];
        expect(createMessageArgs[0]).toBe("123456789");
        expect(createMessageArgs[1].embeds[0].title).toBe("Runtime error on command: top");
        expect(createMessageArgs[1].embeds[0].fields.some((f: any) => f.name === "Message" && f.value === ";top yorunoken")).toBe(
            true,
        );

        // Verifies file logging
        expect(logger.error).toHaveBeenCalled();
    });

    test("handles getGuild throwing gracefully", async () => {
        const error = new Error("Test error");
        mockClient.rest.getGuild = mock(() => Promise.reject(new Error("Guild fetch failed")));

        await handleCommandError(error, {
            client: mockClient,
            interaction: mockInteraction,
            commandName: "ping",
        });

        expect(mockClient.rest.createMessage).toHaveBeenCalled();
        const createMessageArgs = mockClient.rest.createMessage.mock.calls[0];
        // Uses "Unknown Guild" fallback
        expect(createMessageArgs[1].embeds[0].fields.some((f: any) => f.name === "Guild" && f.value.includes("Unknown Guild"))).toBe(
            true,
        );
    });
});
