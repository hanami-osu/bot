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
        const slashOsu = embed.fields?.find(field => field.name === "/osu!");
        const prefixOsu = embed.fields?.find(field => field.name === "osu!");
        const slashGeneral = embed.fields?.find(field => field.name === "/General");

        expect(slashOsu?.value).toContain("`/pp`");
        expect(slashOsu?.value).toContain("`/whatif`");
        expect(prefixOsu?.value).toContain("`pp`");
        expect(prefixOsu?.value).toContain("`whatif`");
        expect(slashGeneral?.value).not.toContain("`/pp`");
        expect(slashGeneral?.value).not.toContain("`/whatif`");
    });
});
