import { describe, expect, test } from "bun:test";
import { CommandInteractionContext, CommandIntegrationType } from "../../src/utils/command-context";
import { buildApplicationCommandPayload } from "../../src/commands/loader";
import type { CommandFileData } from "../../src/types/commands";

describe("command loader helpers", () => {
    test("builds application command payloads for unified commands", () => {
        const command = {
            data: {
                name: "ping",
                description: "Check latency.",
                hasPrefixVariant: true,
            },
            run: () => undefined,
        } satisfies CommandFileData;

        expect(buildApplicationCommandPayload(command)).toEqual({
            name: "ping",
            description: "Check latency.",
            integration_types: [CommandIntegrationType.GuildInstall, CommandIntegrationType.UserInstall],
            contexts: [CommandInteractionContext.Guild, CommandInteractionContext.BotDM, CommandInteractionContext.PrivateChannel],
        });
    });

    test("skips commands without application support", () => {
        const command = {
            data: {
                name: "legacy",
                description: "Legacy prefix-only command.",
                hasPrefixVariant: true,
            },
            runMessage: () => undefined,
        } satisfies CommandFileData;

        expect(buildApplicationCommandPayload(command)).toBeNull();
    });
});
