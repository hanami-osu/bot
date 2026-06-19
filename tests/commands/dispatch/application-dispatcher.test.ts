import { afterEach, describe, expect, mock, test } from "bun:test";
import { dispatchApplicationCommand } from "../../../src/commands/dispatch/application-dispatcher";
import { commandsCache } from "../../../src/state/command-registry";
import type { CommandFileData } from "../../../src/types/commands";

describe("application dispatcher", () => {
    afterEach(() => {
        commandsCache.clear();
    });

    test("responds unavailable for guild-only legacy application handlers in DMs", async () => {
        const runApplication = mock(() => Promise.resolve());
        commandsCache.set("legacy", {
            data: {
                name: "legacy",
                description: "Legacy application command.",
                hasPrefixVariant: false,
                availability: { unavailableMessage: "Guild only." },
            },
            runApplication,
        } satisfies CommandFileData);

        const reply = mock(() => Promise.resolve());

        await dispatchApplicationCommand({
            isApplicationCommandInteraction: () => true,
            inGuild: () => false,
            inDM: () => true,
            user: { id: "user123", username: "tester" },
            data: { name: "legacy", subCommand: undefined },
            client: { rest: {} },
            reply,
        } as any);

        expect(reply).toHaveBeenCalledWith({ content: "Guild only.", ephemeral: true });
        expect(runApplication).not.toHaveBeenCalled();
    });

    test("ignores non-application interactions", async () => {
        await dispatchApplicationCommand({
            isApplicationCommandInteraction: () => false,
        } as any);

        expect(commandsCache.size).toBe(0);
    });
});
