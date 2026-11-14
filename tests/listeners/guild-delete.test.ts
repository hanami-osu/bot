import { afterEach, describe, expect, mock, test } from "bun:test";

const removeEntry = mock(() => Promise.resolve(true));
const loggerError = mock(() => Promise.resolve());

mock.module("@utils/logger", () => ({ logger: { error: loggerError, info: mock(), warn: mock() } }));

mock.module("@utils/database", () => ({
    removeEntry,
    prisma: {
        guild: {
            findMany: mock(() => Promise.resolve([])),
        },
    },
}));

const { guildPrefixesCache } = await import("../../src/state/guild-prefixes");
const { handler } = await import("../../src/utils/lilybird-handler");
await import("../../src/listeners/guild-delete");

const listeners = handler.getListenersObject(false) as {
    guildDelete: (client: unknown, guild: { id: string; unavailable?: boolean }) => Promise<void>;
};

describe("guildDelete listener", () => {
    afterEach(() => {
        removeEntry.mockClear();
        guildPrefixesCache.clear();
    });

    test("preserves guild data when Discord marks the guild temporarily unavailable", async () => {
        guildPrefixesCache.set("guild123", [";"]);

        await listeners.guildDelete({}, { id: "guild123", unavailable: true });

        expect(removeEntry).not.toHaveBeenCalled();
        expect(guildPrefixesCache.get("guild123")).toEqual([";"]);
    });

    test("removes guild data when the bot actually leaves the guild", async () => {
        guildPrefixesCache.set("guild123", [";"]);

        await listeners.guildDelete({}, { id: "guild123" });

        expect(removeEntry).toHaveBeenCalledTimes(1);
        expect(guildPrefixesCache.has("guild123")).toBe(false);
    });

    test("logs database failures instead of rejecting", async () => {
        removeEntry.mockRejectedValueOnce(new Error("db down"));
        guildPrefixesCache.set("guild123", [";"]);

        await listeners.guildDelete({}, { id: "guild123" });

        expect(loggerError).toHaveBeenCalledTimes(1);
        expect(guildPrefixesCache.has("guild123")).toBe(false);
    });

    test("removes guild data when Discord explicitly marks the guild available", async () => {
        guildPrefixesCache.set("guild123", [";"]);

        await listeners.guildDelete({}, { id: "guild123", unavailable: false });

        expect(removeEntry).toHaveBeenCalledTimes(1);
        expect(guildPrefixesCache.has("guild123")).toBe(false);
    });
});
