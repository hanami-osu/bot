import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const incrementCommandCount = mock(() => Promise.resolve());
const loggerInfo = mock(() => Promise.resolve());
const loggerWarn = mock(() => Promise.resolve());
const loggerError = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    prisma: {},
    getEntry: mock(() => Promise.resolve(null)),
    removeEntry: mock(() => Promise.resolve(true)),
    insertData: mock(() => Promise.resolve(true)),
    bulkInsertData: mock(() => Promise.resolve()),
    incrementCommandCount,
}));
mock.module("@utils/logger", () => ({ logger: { info: loggerInfo, warn: loggerWarn, error: loggerError } }));

const { dispatchApplicationCommand } = await import("../../src/commands/dispatch/application-dispatcher");
const { dispatchPrefixCommand } = await import("../../src/commands/dispatch/prefix-dispatcher");
const { run, data } = await import("../../src/commands/general/changelog");
const { commandsCache, commandAliasesCache } = await import("../../src/state/command-registry");
const { registerCommand } = await import("../../src/state/command-registry");

const CHANGELOG_URL = "https://github.com/hanami-osu/bot/commits/main";

function createClient() {
    return {
        rest: {
            getGuild: mock(() => Promise.resolve({ name: "Hanami test server" })),
            triggerTypingIndicator: mock(() => Promise.resolve()),
        },
    };
}

describe("changelog command end-to-end", () => {
    beforeEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        registerCommand({ data, run });
    });

    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
    });

    test("responds to a slash command with the current changelog link", async () => {
        const reply = mock(() => Promise.resolve());
        const client = createClient();

        await dispatchApplicationCommand({
            isApplicationCommandInteraction: () => true,
            inGuild: () => true,
            inDM: () => false,
            guildId: "guild-1",
            channelId: "channel-1",
            member: { user: { id: "user-1", username: "tester" } },
            data: { name: "changelog", subCommand: undefined },
            client,
            reply,
        } as never);

        expect(reply).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "Hanami changelog",
                description: expect.stringContaining(CHANGELOG_URL),
            })],
        });
    });

    test("responds to a prefix command with the current changelog link", async () => {
        const reply = mock(() => Promise.resolve());
        const client = createClient();

        await dispatchPrefixCommand({
            content: ";changelog",
            guildId: "guild-1",
            channelId: "channel-1",
            author: { id: "user-1", username: "tester", bot: false },
            client,
            reply,
            react: mock(() => Promise.resolve()),
            fetchChannel: () => Promise.resolve({ isText: () => true }),
        } as never);

        expect(reply).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "Hanami changelog",
                description: expect.stringContaining(CHANGELOG_URL),
            })],
        });
    });
});
