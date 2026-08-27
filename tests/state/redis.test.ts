import { afterEach, describe, expect, mock, test } from "bun:test";

const connect = mock(() => Promise.resolve());
const quit = mock(() => Promise.resolve());
const disconnect = mock(() => Promise.resolve());
const on = mock(() => undefined);
const createClient = mock(() => ({
    connect,
    quit,
    disconnect,
    on,
    isOpen: true,
}));

mock.module("redis", () => ({ createClient }));
mock.module("@utils/logger", () => ({
    logger: {
        info: mock(() => Promise.resolve()),
        warn: mock(() => Promise.resolve()),
        error: mock(() => Promise.resolve()),
    },
}));

const { closeRedis, getRedisClient, initializeRedis, isRedisAvailable } = await import("../../src/state/redis");

describe("redis state", () => {
    afterEach(() => {
        connect.mockClear();
        quit.mockClear();
        disconnect.mockClear();
        on.mockClear();
        createClient.mockClear();
    });

    test("initializes the configured Redis client and exposes it as available", async () => {
        const previousUrl = process.env.REDIS_URL;
        process.env.REDIS_URL = "redis://cache.example.test:6379/0";

        try {
            await initializeRedis();

            expect(createClient).toHaveBeenCalledWith({ url: "redis://cache.example.test:6379/0" });
            expect(connect).toHaveBeenCalledTimes(1);
            expect(on).toHaveBeenCalledTimes(5);
            expect(isRedisAvailable()).toBe(true);
            expect(getRedisClient()).toBeDefined();
        } finally {
            process.env.REDIS_URL = previousUrl;
        }
    });

    test("closes an open Redis client gracefully", async () => {
        await initializeRedis();
        await closeRedis();

        expect(quit).toHaveBeenCalledTimes(1);
        expect(disconnect).not.toHaveBeenCalled();
    });

    test("rethrows Redis connection failures with context", async () => {
        connect.mockRejectedValueOnce(new Error("connection refused"));

        await expect(initializeRedis()).rejects.toThrow("Redis connection failed: connection refused");
    });

    test("disconnects when graceful Redis shutdown fails", async () => {
        await initializeRedis();
        quit.mockRejectedValueOnce(new Error("quit failed"));

        await closeRedis();

        expect(quit).toHaveBeenCalledTimes(1);
        expect(disconnect).toHaveBeenCalledTimes(1);
    });
});
