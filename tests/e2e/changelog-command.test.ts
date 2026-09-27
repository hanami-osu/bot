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

const RELEASES_URL = "https://github.com/hanami-osu/bot/releases";
const originalFetch = globalThis.fetch;

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
        globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 404 }))) as unknown as typeof fetch;
    });

    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        globalThis.fetch = originalFetch;
    });

    test("shows the latest release notes in a slash command", async () => {
        globalThis.fetch = mock(() => Promise.resolve(Response.json({
            name: "Hanami 1.0",
            tag_name: "v1.0.0",
            body: "Better score filters and pagination.",
            html_url: `${RELEASES_URL}/tag/v1.0.0`,
        }))) as unknown as typeof fetch;
        const deferReply = mock(() => Promise.resolve());
        const editReply = mock((_options: { embeds: Array<{ description: string }> }) => Promise.resolve());
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
            deferReply,
            editReply,
        } as never);

        expect(deferReply).toHaveBeenCalled();
        expect(editReply).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "Hanami changelog",
                description: expect.stringContaining("Better score filters and pagination."),
            })],
        });
        expect(editReply.mock.calls[0]?.[0].embeds[0].description).toContain(`${RELEASES_URL}/tag/v1.0.0`);
    });

    test("shows the releases page before a release is published", async () => {
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
                description: expect.stringContaining(`No releases have been published yet. [View releases](<${RELEASES_URL}>)`),
            })],
        });
    });
});
