import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const incrementCommandCount = mock(() => Promise.resolve());
const loggerInfo = mock(() => Promise.resolve());
const loggerWarn = mock(() => Promise.resolve());
const loggerError = mock(() => Promise.resolve());
const osuUserDetails = mock(() => Promise.resolve({ id: 17279598 }));

mock.module("@utils/database", () => ({
    prisma: {},
    getEntry: mock(() => Promise.resolve(null)),
    removeEntry: mock(() => Promise.resolve(true)),
    insertData: mock(() => Promise.resolve(true)),
    bulkInsertData: mock(() => Promise.resolve()),
    incrementCommandCount,
}));
mock.module("@utils/logger", () => ({ logger: { info: loggerInfo, warn: loggerWarn, error: loggerError } }));
mock.module("osu-api-extended", () => ({ v2: { users: { details: osuUserDetails } } }));

const { run: runPing, data: pingData } = await import("../../src/commands/general/ping");
const { commandsCache, commandAliasesCache } = await import("../../src/state/command-registry");
const { handler } = await import("../../src/utils/lilybird-handler");
const { registerCommand } = await import("../../src/state/command-registry");
await import("../../src/listeners/message-create");
await import("../../src/listeners/interaction-create");

const listeners = handler.getListenersObject(false) as {
    messageCreate: (message: unknown) => Promise<void>;
    interactionCreate: (interaction: unknown) => Promise<void>;
};

function createClient() {
    return {
        ping: mock(() => Promise.resolve({ ws: 42, rest: 50 })),
        rest: {
            triggerTypingIndicator: mock(() => Promise.resolve()),
            getGuild: mock(() => Promise.resolve({ name: "Hanami test server" })),
        },
    };
}

describe("gateway command routing", () => {
    beforeEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        registerCommand({ data: pingData, run: runPing });
        incrementCommandCount.mockClear();
        loggerInfo.mockClear();
        osuUserDetails.mockClear();
    });

    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
    });

    test("routes a prefix message through the ping response", async () => {
        const client = createClient();
        const edit = mock(() => Promise.resolve());
        const reply = mock(() => Promise.resolve({ id: "reply-1", edit }));

        await listeners.messageCreate({
            content: ";ping",
            guildId: "guild-1",
            channelId: "channel-1",
            author: { id: "user-1", username: "tester", bot: false },
            client,
            reply,
            fetchChannel: () => Promise.resolve({ isText: () => true }),
        });

        expect(reply).toHaveBeenCalledWith({ content: "🏓 Checking latency..." });
        expect(edit).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "Pong! 🏓",
                description: expect.stringContaining("Discord WebSocket:** `42ms`"),
            })],
        });
        expect(osuUserDetails).toHaveBeenCalled();
        expect(incrementCommandCount).toHaveBeenCalledWith("ping:prefix");
    });

    test("routes a slash interaction through the ping response", async () => {
        const client = createClient();
        const deferReply = mock(() => Promise.resolve());
        const editReply = mock(() => Promise.resolve({ id: "interaction-reply" }));

        await listeners.interactionCreate({
            isMessageComponentInteraction: () => false,
            isModalSubmitInteraction: () => false,
            isApplicationCommandInteraction: () => true,
            inGuild: () => true,
            inDM: () => false,
            guildId: "guild-1",
            channelId: "channel-1",
            member: { user: { id: "user-1", username: "tester" } },
            data: { name: "ping", subCommand: undefined },
            client,
            deferReply,
            editReply,
        });

        expect(deferReply).toHaveBeenCalled();
        expect(editReply).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "Pong! 🏓",
                description: expect.stringContaining("Discord WebSocket:** `42ms`"),
            })],
        });
        expect(osuUserDetails).toHaveBeenCalled();
        expect(incrementCommandCount).toHaveBeenCalledWith("ping:slash");
    });
});
