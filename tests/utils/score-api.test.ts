import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ScoreData, type User } from "../../src/types/database";
import { Mode, PlayType } from "../../src/types/osu";

const listScoresMock = mock(({ offset }: { offset?: number }, _addons?: { legacy_only: boolean }) => {
    const start = offset ?? 0;
    return Promise.resolve(Array.from({ length: 100 }, (_value, index) => ({ id: start + index + 1 })));
});

mock.module("osu-api-extended", () => ({
    enums: {
        ModsEnum: { HD: 8, HR: 16, DT: 64, NC: 512 },
    },
    v2: {
        scores: {
            list: listScoresMock,
        },
    },
}));

const { getBeatmapUserScores, getUserScores } = await import("../../src/utils/score-api");

function createUser(scoreData: ScoreData | null): User {
    return {
        id: "1",
        banchoId: "1",
        hanamiUserId: null,
        identitySyncedAt: null,
        identityVersion: 0,
        score_embeds: null,
        embed_type: null,
        mode: null,
        score_data: scoreData,
    };
}

describe("score API utilities", () => {
    beforeEach(() => {
        listScoresMock.mockClear();
    });

    test("fetches user scores in offset pages when more than 100 are requested", async () => {
        const scores = await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 200 } }, null);

        expect(scores).toHaveLength(200);
        expect(scores[0]?.position).toBe(1);
        expect(scores[199]?.position).toBe(200);
        expect(listScoresMock).toHaveBeenCalledTimes(2);
        expect(listScoresMock.mock.calls[0]?.[0]).toMatchObject({ type: "user_best", user_id: 1, mode: "osu", limit: 100 });
        expect(listScoresMock.mock.calls[0]?.[0].offset).toBeUndefined();
        expect(listScoresMock.mock.calls[1]?.[0]).toMatchObject({ type: "user_best", user_id: 1, mode: "osu", limit: 100, offset: 100 });
    });

    test("passes legacy_only true for stable user scores", async () => {
        await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 1 } }, createUser(ScoreData.Stable));

        expect(listScoresMock).toHaveBeenCalledTimes(1);
        expect(listScoresMock.mock.calls[0]?.[1]).toEqual({ legacy_only: true });
    });

    test("passes legacy_only false for lazer user scores", async () => {
        await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 1 } }, createUser(ScoreData.Lazer));

        expect(listScoresMock).toHaveBeenCalledTimes(1);
        expect(listScoresMock.mock.calls[0]?.[1]).toEqual({ legacy_only: false });
    });

    test("passes no addons when score data is unset", async () => {
        await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 1 } }, createUser(null));
        await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 1 } }, null);

        expect(listScoresMock).toHaveBeenCalledTimes(2);
        expect(listScoresMock.mock.calls[0]?.[1]).toBeUndefined();
        expect(listScoresMock.mock.calls[1]?.[1]).toBeUndefined();
    });

    test("passes score data addons for beatmap user scores", async () => {
        await getBeatmapUserScores(72727, 1, { query: { mode: Mode.OSU } }, createUser(ScoreData.Stable));
        await getBeatmapUserScores(72727, 1, { query: { mode: Mode.OSU } }, createUser(ScoreData.Lazer));
        await getBeatmapUserScores(72727, 1, { query: { mode: Mode.OSU } }, createUser(null));
        await getBeatmapUserScores(72727, 1, { query: { mode: Mode.OSU } }, null);

        expect(listScoresMock).toHaveBeenCalledTimes(4);
        expect(listScoresMock.mock.calls[0]?.[0]).toMatchObject({ type: "user_beatmap_all", beatmap_id: 72727, user_id: 1, mode: "osu" });
        expect(listScoresMock.mock.calls[0]?.[1]).toEqual({ legacy_only: true });
        expect(listScoresMock.mock.calls[1]?.[1]).toEqual({ legacy_only: false });
        expect(listScoresMock.mock.calls[2]?.[1]).toBeUndefined();
        expect(listScoresMock.mock.calls[3]?.[1]).toBeUndefined();
    });
});
