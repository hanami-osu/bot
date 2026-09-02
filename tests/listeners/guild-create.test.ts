import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Guild } from "../../src/types/database";

const getEntry = mock(async (): Promise<Guild | null> => null);
const insertData = mock(async (): Promise<boolean> => true);
const loggerWarn = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    getEntry,
    insertData,
    prisma: {
        guild: {
            findMany: mock(() => Promise.resolve([])),
        },
    },
}));
mock.module("@utils/logger", () => ({
    logger: {
        warn: loggerWarn,
    },
}));

const { handler } = await import("../../src/utils/lilybird-handler");
await import("../../src/listeners/guild-create");

interface TestChannel {
    id: string;
    position: number;
    send: ReturnType<typeof mock>;
    isText: () => boolean;
    isAnnouncement: () => boolean;
}

interface TestGuild {
    id: string;
    name: string;
    ownerId: string;
    joinedAt: string;
    systemChannelId: string | null;
    channels: Array<TestChannel>;
}

const listeners = handler.getListenersObject(false) as unknown as {
    guildCreate: (guild: TestGuild) => Promise<void>;
};

function createChannel(id: string, position: number, send = mock(() => Promise.resolve())): TestChannel {
    return {
        id,
        position,
        send,
        isText: () => true,
        isAnnouncement: () => false,
    };
}

function createGuild(channels: Array<TestChannel>, systemChannelId: string | null = null): TestGuild {
    return {
        id: "guild123",
        name: "Test guild",
        ownerId: "owner123",
        joinedAt: "2026-09-03T00:00:00.000Z",
        systemChannelId,
        channels,
    };
}

afterEach(() => {
    getEntry.mockReset();
    getEntry.mockResolvedValue(null);
    insertData.mockReset();
    insertData.mockResolvedValue(true);
    loggerWarn.mockClear();
});

describe("guildCreate listener", () => {
    test("posts a short welcome embed to a new guild's system channel", async () => {
        const systemChannel = createChannel("system", 1);

        await listeners.guildCreate(createGuild([systemChannel], systemChannel.id));

        expect(systemChannel.send).toHaveBeenCalledTimes(1);
        const message = systemChannel.send.mock.calls[0]?.[0] as { embeds?: Array<{ title?: string; fields?: Array<unknown> }> };
        expect(message.embeds?.[0]?.title).toBe("Welcome to Hanami!");
        expect(message.embeds?.[0]?.fields?.length).toBeLessThanOrEqual(2);
    });

    test("does not post onboarding when a known guild becomes available again", async () => {
        const systemChannel = createChannel("system", 1);
        insertData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        getEntry.mockResolvedValue({
            id: "guild123",
            name: "Test guild",
            owner_id: "owner123",
            joined_at: "2026-09-03T00:00:00.000Z",
            prefixes: null,
        });

        await listeners.guildCreate(createGuild([systemChannel], systemChannel.id));

        expect(systemChannel.send).not.toHaveBeenCalled();
    });

    test("posts once when duplicate events both observe a missing guild record", async () => {
        const systemChannel = createChannel("system", 1);
        insertData.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const guild = createGuild([systemChannel], systemChannel.id);

        await listeners.guildCreate(guild);
        await listeners.guildCreate(guild);

        expect(systemChannel.send).toHaveBeenCalledTimes(1);
    });

    test("falls back to the first text channel that accepts the welcome message", async () => {
        const systemChannel = createChannel("system", 5, mock(() => Promise.reject(new Error("Missing Access"))));
        const laterChannel = createChannel("later", 10);
        const firstChannel = createChannel("first", 2);

        await listeners.guildCreate(createGuild([laterChannel, systemChannel, firstChannel], systemChannel.id));

        expect(firstChannel.send).toHaveBeenCalledTimes(1);
        expect(laterChannel.send).not.toHaveBeenCalled();
    });

    test("contains welcome delivery failures when no channel is writable", async () => {
        const failure = new Error("Missing Permissions");
        const channel = createChannel("general", 1, mock(() => Promise.reject(failure)));

        await expect(listeners.guildCreate(createGuild([channel]))).resolves.toBeUndefined();

        expect(loggerWarn).toHaveBeenCalledWith("Could not send guild welcome message", {
            error: failure,
            guildId: "guild123",
        });
    });
});
