import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const mapData = `osu file format v14
[General]
AudioFilename: audio.mp3
Mode: 0
[Metadata]
Title:Test Title
Artist:Test Artist
Creator:Test Mapper
Version:Expert
[Difficulty]
HPDrainRate:5
CircleSize:4
OverallDifficulty:8
ApproachRate:9
SliderMultiplier:1.4
SliderTickRate:1
[HitObjects]
${Array.from({ length: 100 }, (_, index) => `${64 + (index % 8) * 64},192,${1000 + index * 500},1,0,0:0:0:0:`).join("\n")}
`;

const beatmapset = { id: 1, artist: "Test Artist", title: "Test Song", creator: "Test Mapper", status: "ranked" };
const score = {
    id: 1,
    user_id: 42,
    accuracy: 0.95,
    max_combo: 60,
    passed: true,
    pp: null,
    rank: "A",
    mode: "osu",
    statistics: { count_300: 90, count_100: 5, count_50: 0, count_miss: 5 },
    beatmap: {
        id: 101,
        mode: "osu",
        version: "Expert",
        total_length: 60,
        max_combo: 100,
        difficulty_rating: 4,
        checksum: null,
        beatmapset,
    },
    beatmapset,
    mods: [],
    created_at: "2026-01-01T00:00:00Z",
};
const secondBeatmapset = { ...beatmapset, title: "Second Song" };
const scores = [{
    ...score,
    id: 2,
    max_combo: 98,
    pp: 42,
    statistics: { count_300: 99, count_100: 0, count_50: 0, count_miss: 1 },
    beatmap: { ...score.beatmap, id: 102, beatmapset: secondBeatmapset },
    beatmapset: secondBeatmapset,
}, score];

const incrementCommandCount = mock(() => Promise.resolve());
const getEntry = mock((table: string) => Promise.resolve(table === "maps" ? { id: "101", data: mapData } : null));
const osuUserDetails = mock(() => Promise.resolve({ id: 42, username: "peppy", statistics: { pp: 50 } }));
const osuScoresList = mock(() => Promise.resolve(scores));
const loggerInfo = mock(() => Promise.resolve());
const loggerWarn = mock(() => Promise.resolve());
const loggerError = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    prisma: {},
    getEntry,
    removeEntry: mock(() => Promise.resolve(true)),
    insertData: mock(() => Promise.resolve(true)),
    bulkInsertData: mock(() => Promise.resolve()),
    incrementCommandCount,
}));
mock.module("@utils/logger", () => ({ logger: { info: loggerInfo, warn: loggerWarn, error: loggerError } }));
mock.module("osu-api-extended", () => ({
    enums: { ModsEnum: { HD: 8, HR: 16, DT: 64, NC: 512 } },
    v2: {
        users: { details: osuUserDetails },
        scores: { list: osuScoresList },
    },
}));

const { dispatchApplicationCommand } = await import("../../src/commands/dispatch/application-dispatcher");
const { run, data } = await import("../../src/commands/osu/nochoke");
const { commandsCache, commandAliasesCache } = await import("../../src/state/command-registry");
const { registerCommand } = await import("../../src/state/command-registry");

describe("nochoke command end-to-end", () => {
    beforeEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
        registerCommand({ data, run });
        getEntry.mockClear();
        osuUserDetails.mockClear();
        osuScoresList.mockClear();
        incrementCommandCount.mockClear();
        loggerInfo.mockClear();
    });

    afterEach(() => {
        commandsCache.clear();
        commandAliasesCache.clear();
    });

    test("adds weighted FC gains to the user's current total", async () => {
        const deferReply = mock(() => Promise.resolve());
        const editReply = mock((_response: { embeds: Array<{ title?: string; description?: string }> }) => Promise.resolve({ id: "interaction-reply" }));
        const client = { rest: { getGuild: mock(() => Promise.resolve({ name: "test server" })) } };

        await dispatchApplicationCommand({
            isApplicationCommandInteraction: () => true,
            inGuild: () => true,
            inDM: () => false,
            guildId: "guild-1",
            channelId: "channel-1",
            member: { user: { id: "user-1", username: "tester" } },
            data: {
                name: "nochoke",
                subCommand: undefined,
                getString: (name: string) => name === "username" ? "peppy" : name === "mode" ? "osu" : undefined,
                getUser: () => undefined,
                getNumber: () => undefined,
                getInteger: () => undefined,
                getBoolean: () => undefined,
            },
            client,
            deferReply,
            editReply,
        } as never);

        expect(deferReply).toHaveBeenCalled();
        expect(osuScoresList).toHaveBeenCalledWith(
            expect.objectContaining({ type: "user_best", user_id: 42, mode: "osu", limit: 100 }),
            undefined,
        );
        expect(editReply).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                title: "peppy's no-choke estimate",
                description: expect.stringContaining("Current total:** 50.00pp"),
            })],
        });
        const response = editReply.mock.calls[0]?.[0];
        expect(response?.embeds[0]?.description).toContain("No-choke top 2:** 77.00pp (+27.00pp)");
        expect(response?.embeds[0]?.description).toContain("Test Artist - Test Song [Expert]: 9.99 → 27.08pp (+17.09pp)");
    });

    test("routes the prefix alias through the same no-choke calculation", async () => {
        const reply = mock(() => Promise.resolve({ id: "message-reply", edit: mock(() => Promise.resolve()) }));
        const client = {
            rest: {
                triggerTypingIndicator: mock(() => Promise.resolve()),
                getGuild: mock(() => Promise.resolve({ name: "test server" })),
            },
        };

        const { dispatchPrefixCommand } = await import("../../src/commands/dispatch/prefix-dispatcher");
        await dispatchPrefixCommand({
            content: ";nc peppy",
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
                title: "peppy's no-choke estimate",
                description: expect.stringContaining("No-choke top 2:"),
            })],
        });
    });
});
