import { afterEach, describe, expect, mock, test } from "bun:test";
import { commandsCache, commandAliasesCache } from "../../src/state/command-registry";
import type { CommandFileData } from "../../src/types/commands";

mock.module("@utils/database", () => ({
    getRowCount: mock(() => Promise.resolve(0)),
    getRowSum: mock(() => Promise.resolve(0)),
}));

const { formatCooldown, helpBuilder } = await import("../../src/embed-builders/help");

function registerCommand(name: string, hasPrefixVariant = true): void {
    commandsCache.set(name, {
        data: {
            name,
            description: `${name} command`,
            hasPrefixVariant,
        },
    } satisfies CommandFileData);
}

afterEach(() => {
    commandsCache.clear();
    commandAliasesCache.clear();
});

describe("help builder", () => {
    test.each([
        [undefined, "1 second"],
        [1000, "1 second"],
        [1500, "1.5 seconds"],
        [2000, "2 seconds"],
    ] as const)("formats %p cooldown as %p", (cooldown, expected) => {
        expect(formatCooldown(cooldown)).toBe(expected);
    });

    test("groups pp and whatif with osu commands", async () => {
        registerCommand("ping");
        registerCommand("pp");
        registerCommand("whatif");

        const [embed] = await helpBuilder();
        const performanceTools = embed.fields?.find(field => field.name === "Beatmaps & performance");
        const botCommands = embed.fields?.find(field => field.name === "Hanami");

        expect(performanceTools?.value).toContain("`/pp`");
        expect(performanceTools?.value).toContain("`/whatif`");
        expect(botCommands?.value).toContain("`/ping`");
        expect(botCommands?.value).not.toContain("`/pp`");
        expect(botCommands?.value).not.toContain("`/whatif`");
    });

    test("gives new users a short starting path without duplicating prefix command lists", async () => {
        registerCommand("link", false);
        registerCommand("profile");
        registerCommand("recent");
        registerCommand("top");

        const [embed] = await helpBuilder();
        const gettingStarted = embed.fields?.find(field => field.name === "Start here");

        expect(embed.description).toContain("profiles, scores, beatmaps, and performance tools");
        expect(gettingStarted?.value).toContain("`/link`");
        expect(gettingStarted?.value).toContain("`/profile`");
        expect(gettingStarted?.value).toContain("`/recent`");
        expect(gettingStarted?.value).toContain("`/top`");
        expect(embed.fields?.some(field => field.name === "Message Commands")).toBe(false);
        expect(embed.fields?.length).toBeLessThanOrEqual(7);
    });
});
