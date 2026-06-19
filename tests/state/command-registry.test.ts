import { afterEach, describe, expect, test } from "bun:test";
import { commandAliasesCache, commandsCache, getSlashCommandMention, registerCommand, registerSlashCommandId, resolveCommand, slashCommandIdsCache } from "../../src/state/command-registry";
import type { CommandFileData } from "../../src/types/commands";

describe("command registry", () => {
    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        slashCommandIdsCache.clear();
    });

    test("registers commands and aliases", () => {
        const command = {
            data: {
                name: "recent",
                description: "Show recent plays.",
                hasPrefixVariant: true,
                message: { aliases: ["rs", "r"] },
            },
            run: () => undefined,
        } satisfies CommandFileData;

        registerCommand(command);

        expect(resolveCommand("recent")).toBe(command);
        expect(resolveCommand("rs")).toBe(command);
        expect(resolveCommand("r")).toBe(command);
    });

    test("formats cached slash command ids as mentions", () => {
        registerSlashCommandId("link", "123456");

        expect(slashCommandIdsCache.get("link")).toBe("123456");
        expect(getSlashCommandMention("link")).toBe("</link:123456>");
    });

    test("keeps old full mention cache values compatible", () => {
        slashCommandIdsCache.set("link", "</link:123456>");

        expect(getSlashCommandMention("link")).toBe("</link:123456>");
    });

    test("falls back to slash command text without a cached id", () => {
        expect(getSlashCommandMention("link")).toBe("/link");
    });
});
