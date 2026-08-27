import { describe, expect, mock, test } from "bun:test";

const databaseError = new Error("database unavailable");
const findMany = mock(() => Promise.reject(databaseError));

mock.module("@utils/database", () => ({
    prisma: { guild: { findMany } },
}));
mock.module("@utils/logger", () => ({
    logger: {
        error: mock(() => Promise.resolve()),
        info: mock(() => Promise.resolve()),
    },
}));

const { loadGuildPrefixes } = await import("../../src/state/guild-prefixes");

describe("guild prefix readiness", () => {
    test("propagates database failures so startup cannot be marked ready", async () => {
        expect(loadGuildPrefixes()).rejects.toBe(databaseError);
    });
});
