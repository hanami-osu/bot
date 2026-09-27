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
const buttonStateSet = mock(() => Promise.resolve());
const getEntry = mock((table: string) => Promise.resolve(table === "maps" ? { id: "101", data: mapData } : null));
const osuUserDetails = mock(() => Promise.resolve({
    id: 42,
    username: "peppy",
    avatar_url: "https://a.ppy.sh/42",
    cover: { url: "https://assets.ppy.sh/user-profile-covers/42/cover.jpg" },
    country: { code: "US" },
    country_code: "US",
    join_date: "2010-01-01T00:00:00Z",
    follower_count: 1000,
    occupation: null,
    interests: null,
    location: null,
    rank_highest: null,
    statistics: {
        pp: 50,
        global_rank: 123,
        country_rank: 4,
        hit_accuracy: 98.5,
        level: { current: 100, progress: 50 },
        play_count: 5000,
        play_time: 360000,
        maximum_combo: 2000,
        ranked_score: 1000000,
        total_score: 5000000,
        total_hits: 100000,
        grade_counts: { s: 10, a: 20, ss: 5, sh: 2, ssh: 1 },
    },
}));
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
mock.module("../../src/state/button-state-cache", () => ({
    ButtonStateCache: {
        get: mock(() => Promise.resolve(null)),
        set: buttonStateSet,
    },
}));
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
        buttonStateSet.mockClear();
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
        expect(editReply).toHaveBeenCalledWith(expect.objectContaining({
            embeds: [expect.objectContaining({
                author: expect.objectContaining({ name: "peppy 50pp (#123 US#4)" }),
                thumbnail: { url: "https://a.ppy.sh/42" },
                title: "**Total pp:** 50.00pp → **77.00pp** (+27.00pp)",
            })],
        }));
        const response = editReply.mock.calls[0]?.[0] as any;
        expect(response?.embeds[0]?.description).toContain("Test Song [Expert]");
        expect(response?.embeds[0]?.description).toContain("9.99pp → **27.08pp** (+17.09pp)");
        expect(response?.embeds[0]?.description).toContain("90/5/0/5 → **95/5/0/0**");
        expect(response?.embeds[0]?.description).toContain("**60** → **100**/100x");
        expect(response?.embeds[0]).not.toHaveProperty("footer");
        const labels = (response?.components ?? []).flatMap((row: any) => (row.components ?? []).map((button: any) => button.label));
        expect(labels).toContain("1 / 1");
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

        expect(reply).toHaveBeenCalledWith(expect.objectContaining({
            embeds: [expect.objectContaining({
                author: expect.objectContaining({ name: "peppy 50pp (#123 US#4)" }),
                title: expect.stringContaining("Total pp"),
            })],
        }));
    });

    test("paginates gains across multiple pages like top", async () => {
        const { buildNoChokePaginationMessageOptions } = await import("../../src/services/nochoke-service");
        const { getTotalItems, updateBuilderOptions, PaginationAction, PaginationType } = await import("../../src/utils/pagination");

        osuScoresList.mockResolvedValueOnce(Array.from({ length: 7 }, (_, index) => ({
            ...score,
            id: 100 + index,
            pp: null,
            max_combo: 60,
            statistics: { count_300: 90, count_100: 5, count_50: 0, count_miss: 5 },
            beatmap: { ...score.beatmap, id: 200 + index },
        })));

        const deferReply = mock(() => Promise.resolve());
        const editReply = mock(() => Promise.resolve({ id: "interaction-reply" }));
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

        const getLabels = (components: any) => components.flatMap((row: any) => (row.components ?? []).map((button: any) => button.label));
        const firstReply = (editReply.mock.calls as Array<Array<any>>)[0]?.[0];
        expect(getLabels(firstReply?.components ?? [])).toContain("1 / 2");

        const cachedOptions = (buttonStateSet.mock.calls as Array<Array<any>>)
            .map(call => call[1] as { type?: string })
            .find(options => options.type === "nochokeBuilder");
        expect(cachedOptions).toBeDefined();
        expect(getTotalItems(cachedOptions as any)).toBe(7);

        const nextReply = await buildNoChokePaginationMessageOptions(
            updateBuilderOptions(cachedOptions as any, PaginationAction.NEXT, PaginationType.PAGE) as any,
        );
        expect(getLabels(nextReply.components)).toContain("2 / 2");
        expect(nextReply.embeds[0]?.title).toContain("Total pp");
    });
});
