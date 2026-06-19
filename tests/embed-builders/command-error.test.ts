import { describe, expect, test } from "bun:test";
import { commandErrorDisplayName, commandErrorLogEmbed } from "../../src/embed-builders/command-error";

describe("command error embed builder", () => {
    test("formats slash command runtime errors", () => {
        const error = new Error("Boom");
        error.stack = "Error: Boom\n    at trace";

        const embed = commandErrorLogEmbed({
            commandName: "ping",
            subCommand: "pong",
            isInteraction: true,
            user: { id: "user-1", username: "tester" },
            guildName: "Guild",
            guildId: "guild-1",
            channelId: "channel-1",
            error,
        });

        expect(commandErrorDisplayName("ping", "pong", true)).toBe("ping -> pong");
        expect(embed.title).toBe("Runtime error on command (slash): ping -> pong");
        expect(embed.fields).toContainEqual({ name: "User", value: "<@user-1> (tester)" });
        expect(embed.fields).toContainEqual({ name: "Guild", value: "[Guild](https://discord.com/channels/guild-1/channel-1)" });
        expect(embed.fields).toContainEqual({ name: "Error", value: "Error: Boom\n    at trace" });
    });

    test("includes message content for prefix command errors", () => {
        const embed = commandErrorLogEmbed({
            commandName: "top",
            isInteraction: false,
            user: { id: "user-1", username: "tester" },
            guildName: "Guild",
            content: ";top mrekk",
            error: new Error("Boom"),
        });

        expect(embed.title).toBe("Runtime error on command: top");
        expect(embed.fields).toContainEqual({ name: "Message", value: ";top mrekk" });
    });
});
