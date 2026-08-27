import { afterEach, describe, expect, mock, test } from "bun:test";

const findMany = mock(() =>
    Promise.resolve([
        { id: "guild-a", prefixes: '[";","!"]' },
        { id: "guild-b", prefixes: "not-json" },
    ]),
);
const loggerError = mock(() => Promise.resolve());
const loggerInfo = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    prisma: { guild: { findMany } },
}));
mock.module("@utils/logger", () => ({
    logger: { error: loggerError, info: loggerInfo },
}));

const { guildPrefixesCache, loadGuildPrefixes } = await import("../../src/state/guild-prefixes");

describe("guild prefix loading", () => {
    afterEach(() => {
        guildPrefixesCache.clear();
        findMany.mockClear();
        loggerError.mockClear();
        loggerInfo.mockClear();
    });

    test("loads valid prefixes while isolating malformed guild rows", async () => {
        await loadGuildPrefixes();

        expect(findMany).toHaveBeenCalledTimes(1);
        expect(guildPrefixesCache.get("guild-a")).toEqual([";", "!"]);
        expect(guildPrefixesCache.has("guild-b")).toBe(false);
        expect(loggerError).toHaveBeenCalledTimes(1);
        expect(loggerInfo).toHaveBeenCalledWith("Loaded 1/2 guild prefixes into cache");
    });
});
