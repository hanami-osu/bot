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

describe("command registration readiness", () => {
    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        slashCommandIdsCache.clear();
    });

    test("propagates global application registration failures", async () => {
        const previousDev = process.env.DEV;
        process.env.DEV = "false";
        const registrationError = new Error("registration failed");
        const client = {
            user: { id: "app-1" },
            rest: {
                bulkOverwriteGlobalApplicationCommand: mock(() => Promise.reject(registrationError)),
            },
        } as any;

        try {
            expect(loadCommands(client)).rejects.toBe(registrationError);
        } finally {
            process.env.DEV = previousDev;
        }
    });

    test("propagates development guild registration failures", async () => {
        const previousDev = process.env.DEV;
        const previousDevGuildId = process.env.DEV_GUILD_ID;
        process.env.DEV = "true";
        process.env.DEV_GUILD_ID = "guild-1";
        const registrationError = new Error("dev registration failed");
        const client = {
            user: { id: "app-1" },
            rest: {
                makeAPIRequest: mock(() => Promise.reject(registrationError)),
            },
        } as any;

        try {
            expect(loadCommands(client)).rejects.toBe(registrationError);
        } finally {
            process.env.DEV = previousDev;
            process.env.DEV_GUILD_ID = previousDevGuildId;
        }
    });
});
