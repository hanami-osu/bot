import { describe, expect, mock, test } from "bun:test";

const loadCommands = mock(() => Promise.resolve());
const refreshGuildsDatabase = mock(() => Promise.resolve());
const loadGuildPrefixes = mock(() => Promise.resolve());
const markReady = mock(() => Promise.resolve());

mock.module("@utils/initialize", () => ({
    loadCommands,
    refreshGuildsDatabase,
    loadGuildPrefixes,
}));
mock.module("@utils/logger", () => ({
    logger: {
        info: mock(() => Promise.resolve()),
    },
}));
mock.module("@utils/readiness", () => ({ markReady }));

const { handler } = await import("../../src/utils/lilybird-handler");
await import("../../src/listeners/ready");

const listeners = handler.getListenersObject(false) as {
    ready: (client: unknown) => Promise<void>;
};

describe("ready listener", () => {
    test("does not mark ready when an essential startup step fails", async () => {
        const startupError = new Error("prefix load failed");
        loadGuildPrefixes.mockRejectedValueOnce(startupError);

        await expect(listeners.ready({ user: { username: "hanami" } })).rejects.toBe(startupError);

        expect(loadCommands).toHaveBeenCalledTimes(1);
        expect(refreshGuildsDatabase).toHaveBeenCalledTimes(1);
        expect(markReady).not.toHaveBeenCalled();
    });
});
