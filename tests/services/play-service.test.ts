import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EmbedBuilderType, type ModStructure, type PlayPaginationOptions } from "../../src/types/builders";
import { Mode, PlayType } from "../../src/types/osu";
import type { Score, UserExtended } from "../../src/types/osu";

const userDetailsMock = mock(({ user }: { user: string }) => {
    if (user === "missing") return Promise.resolve({ error: { message: "not found" } });
    return Promise.resolve({
        id: 1,
        username: user,
        statistics: {},
        country: {},
        cover: {},
    });
});

const getUserScoresMock = mock((): Promise<Array<Score>> => Promise.resolve([]));
const saveScoreDatasMock = mock(() => Promise.resolve());
const getFormattedProfileMock = mock((user: UserExtended) => ({
    username: user.username,
    pp: "10,000",
    globalRank: "1",
    countryCode: "US",
    countryRank: "1",
    userUrl: `https://osu.ppy.sh/users/${user.id}`,
    avatarUrl: "https://a.ppy.sh/1",
    flagUrl: "https://osu.ppy.sh/images/flags/US.png",
}));
const getFormattedScoreMock = mock(({ scores, index }: { scores: Array<any>; index: number }) =>
    Promise.resolve({
        position: scores[index].position ?? index + 1,
        songNameFormatted: `Artist - ${scores[index].beatmapset.title}`,
        songArtist: "Artist",
        songName: scores[index].beatmapset.title,
        retries: 1,
        percentagePassed: null,
        difficultyName: "Expert",
        score: "1,000,000",
        accuracy: "99.00",
        mapLink: `https://osu.ppy.sh/beatmaps/${scores[index].beatmap.id}`,
        coverLink: "https://assets.ppy.sh/beatmaps/1/covers/cover.jpg",
        listLink: "https://assets.ppy.sh/beatmaps/1/covers/list.jpg",
        thumbLink: "https://b.ppy.sh/thumb/1l.jpg",
        grade: "A",
        hitValues: "500/0/0",
        fcHitValues: "",
        fcAccuracy: undefined,
        isFc: true,
        mapAuthor: "mapper",
        mapStatus: "Ranked",
        mods: ["HR"],
        drainLength: "2:00",
        stars: "8.00★",
        rulesetEmote: "<:osu:1075928454484205588>",
        pp: 500,
        ppFormatted: "500.00pp",
        playSubmitted: "1 day ago",
        ifFcHanami: null,
        ifFcBathbot: null,
        ifFcOwo: null,
        comboValues: "1,000/1,000x",
        performance: null,
        user: undefined,
        userId: undefined,
    }),
);

mock.module("osu-api-extended", () => ({
    enums: {
        ModsEnum: { HD: 8, HR: 16, DT: 64, NC: 512 },
    },
    v2: {
        users: {
            details: userDetailsMock,
        },
    },
}));

mock.module("@utils/score-api", () => ({
    USER_SCORE_FETCH_LIMIT: 200,
    getUserScores: getUserScoresMock,
}));

mock.module("@utils/osu", () => ({
    saveScoreDatas: saveScoreDatasMock,
}));

mock.module("@utils/formatter", () => ({
    getFormattedProfile: getFormattedProfileMock,
    getFormattedScore: getFormattedScoreMock,
}));

const { buildPlayPaginationMessageOptions, getFetchedPlayReply } = await import("../../src/services/play-service");

function commandUser(banchoId: string) {
    return {
        type: "success",
        banchoId,
        mode: Mode.OSU,
        authorDb: null,
    } as never;
}

function play(id: number, title: string, mods: Array<string>, createdAt: string): Score {
    return {
        id,
        user_id: 1,
        accuracy: 0.99,
        max_combo: 1000,
        passed: true,
        pp: 500,
        rank: "A" as const,
        score: 1000000,
        statistics: {},
        beatmap: { id, version: "Expert", total_length: 120 } as never,
        beatmapset: { id, title, title_unicode: title, artist: "Artist", creator: "mapper", status: "ranked" },
        created_at: createdAt,
        mods,
        position: id,
    };
}

describe("play service", () => {
    beforeEach(() => {
        userDetailsMock.mockClear();
        getUserScoresMock.mockClear();
        saveScoreDatasMock.mockClear();
        getFormattedProfileMock.mockClear();
        getFormattedScoreMock.mockClear();
        getUserScoresMock.mockImplementation(() => Promise.resolve([]));
    });

    test("returns a not-found embed when osu user lookup fails", async () => {
        const result = await getFetchedPlayReply({
            user: commandUser("missing"),
            authorId: "123",
            playType: PlayType.RECENT,
            emptyMessage: (username) => `empty ${username}`,
        });

        expect(result.embedOptions).toBeUndefined();
        expect(result.reply.embeds?.[0]?.title).toBe("Uh oh! :x:");
        expect(result.reply.embeds?.[0]?.description).toContain("doesn't exist");
    });

    test("returns the provided empty message when no scores are fetched", async () => {
        const result = await getFetchedPlayReply({
            user: commandUser("peppy"),
            authorId: "123",
            playType: PlayType.BEST,
            emptyMessage: (username) => `It seems like \`${username}\` doesn't have any plays, maybe they should go set some :)`,
        });

        expect(result.embedOptions).toBeUndefined();
        expect(result.reply.embeds?.[0]?.description).toBe(
            "It seems like `peppy` doesn't have any plays, maybe they should go set some :)",
        );
    });

    test("fetches recent scores with the expected mode, limit, and include-fails flag", async () => {
        getUserScoresMock.mockImplementation(() => Promise.resolve([play(1, "Recent Song", ["HR"], "2024-01-01T00:00:00Z")]));

        const result = await getFetchedPlayReply({
            user: commandUser("peppy"),
            authorId: "123",
            playType: PlayType.RECENT,
            index: 0,
            isPage: false,
            includeFails: false,
            emptyMessage: (username) => `empty ${username}`,
        });

        expect(result.embedOptions).toBeDefined();
        expect(getUserScoresMock).toHaveBeenCalledWith(
            1,
            PlayType.RECENT,
            { query: { mode: Mode.OSU, limit: 200, include_fails: false } },
            null,
        );
        expect(result.reply.components).toBeDefined();
        expect(result.reply.embeds?.[0]?.title).toBe("Artist - Recent Song");
    });

    test("filters and sorts raw plays before formatting the current page", async () => {
        const includeHr: ModStructure = {
            include: true,
            exclude: null,
            forceInclude: null,
            name: "HR",
        };
        const plays = [
            play(1, "Match Song Old", ["HR"], "2020-01-01T00:00:00Z"),
            play(2, "Match Song New", ["HR"], "2022-01-01T00:00:00Z"),
            play(3, "Match Song Hidden", ["HD"], "2023-01-01T00:00:00Z"),
            play(4, "Other", ["HR"], "2024-01-01T00:00:00Z"),
        ];

        await buildPlayPaginationMessageOptions({
            type: EmbedBuilderType.PLAYS,
            initiatorId: "123",
            user: { id: 1, username: "peppy", statistics: {}, country: {}, cover: {} } as never,
            mode: Mode.OSU,
            authorDb: null,
            plays,
            isMultiple: true,
            sortByDate: true,
            page: 0,
            isPage: true,
            mods: includeHr,
            titleFilter: "match",
        } satisfies PlayPaginationOptions);

        expect(saveScoreDatasMock).toHaveBeenCalledWith(plays, Mode.OSU);
        expect(getFormattedScoreMock).toHaveBeenCalledTimes(2);
        const firstFormatCall = getFormattedScoreMock.mock.calls[0]?.[0] as { scores: Array<{ id: number }>; index: number };
        const secondFormatCall = getFormattedScoreMock.mock.calls[1]?.[0] as { scores: Array<{ id: number }>; index: number };
        expect(firstFormatCall.scores.map((score) => score.id)).toEqual([2, 1]);
        expect(firstFormatCall.index).toBe(0);
        expect(secondFormatCall.index).toBe(1);
    });

    test("formats the page view when both page and index are present", async () => {
        const plays = Array.from({ length: 6 }, (_value, index) =>
            play(index + 1, `Song ${index + 1}`, ["HR"], "2024-01-01T00:00:00Z"),
        );

        await buildPlayPaginationMessageOptions({
            type: EmbedBuilderType.PLAYS,
            initiatorId: "123",
            user: { id: 1, username: "peppy", statistics: {}, country: {}, cover: {} } as never,
            mode: Mode.OSU,
            authorDb: null,
            plays,
            isMultiple: true,
            page: 0,
            index: 2,
            isPage: true,
        } satisfies PlayPaginationOptions);

        expect(getFormattedScoreMock).toHaveBeenCalledTimes(5);
        expect(getFormattedScoreMock.mock.calls.map((call) => (call[0] as { index: number }).index)).toEqual([0, 1, 2, 3, 4]);
    });
});
