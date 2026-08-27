import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("@utils/logger", () => ({
    logger: {
        debug: mock(() => Promise.resolve()),
        info: mock(() => Promise.resolve()),
        warn: mock(() => Promise.resolve()),
        error: mock(() => Promise.resolve()),
        fatal: mock(() => Promise.resolve()),
    },
}));

const { loadCommands } = await import("../../src/commands/loader");
const { commandAliasesCache, commandsCache, slashCommandIdsCache } = await import("../../src/state/command-registry");

describe("command loader runtime", () => {
    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        slashCommandIdsCache.clear();
    });

    test("discovers and registers command modules without publishing application commands", async () => {
        process.argv.push("--no-application");

        try {
            await loadCommands({} as never);

            expect(commandsCache.has("ping")).toBe(true);
            expect(commandsCache.has("recent")).toBe(true);
            expect(commandsCache.has("template")).toBe(false);
            expect(commandAliasesCache.get("r")).toBe("recent");
            expect(commandsCache.size).toBeGreaterThan(10);
        } finally {
            const flagIndex = process.argv.lastIndexOf("--no-application");
            if (flagIndex !== -1) process.argv.splice(flagIndex, 1);
        }
    });
});
