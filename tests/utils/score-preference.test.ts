import { describe, expect, test } from "bun:test";
import { ScoreData, type User } from "../../src/types/database";
import { Mode } from "../../src/types/osu";
import {
    getLegacyOnlyQueryValue,
    getScoreAccuracy,
    getScoreFetchAddons,
    getScoreValue,
    shouldUseLazerPerformance,
    type ScoreLike,
} from "../../src/utils/score-preference";

function createUser(scoreData: ScoreData | null): User {
    return {
        id: "1",
        banchoId: "1",
        score_embeds: null,
        embed_type: null,
        mode: null,
        score_data: scoreData,
    };
}

const score = {
    accuracy: 0.99,
    score: 400,
    total_score: 300,
    legacy_total_score: 100,
    classic_total_score: 200,
    legacy_score_id: null,
} satisfies ScoreLike;

describe("score preference utilities", () => {
    test("maps score data to API legacy_only addons", () => {
        expect(getScoreFetchAddons(createUser(ScoreData.Stable))).toEqual({ legacy_only: true });
        expect(getScoreFetchAddons(createUser(ScoreData.Lazer))).toEqual({ legacy_only: false });
        expect(getScoreFetchAddons(createUser(null))).toBeUndefined();
        expect(getScoreFetchAddons(null)).toBeUndefined();
    });

    test("maps score data to leaderboard legacy_only query values", () => {
        expect(getLegacyOnlyQueryValue(createUser(ScoreData.Stable))).toBe("1");
        expect(getLegacyOnlyQueryValue(createUser(ScoreData.Lazer))).toBe("0");
        expect(getLegacyOnlyQueryValue(createUser(null))).toBeUndefined();
        expect(getLegacyOnlyQueryValue(null)).toBeUndefined();
    });

    test("chooses stable score fields before lazer fields", () => {
        expect(getScoreValue(score, createUser(ScoreData.Stable))).toBe(100);
        expect(getScoreValue({ ...score, legacy_total_score: 0 }, createUser(ScoreData.Stable))).toBe(200);
        expect(getScoreValue({ ...score, legacy_total_score: 0, classic_total_score: 0 }, createUser(ScoreData.Stable))).toBe(300);
    });

    test("chooses lazer score fields before stable fields", () => {
        expect(getScoreValue(score, createUser(ScoreData.Lazer))).toBe(300);
        expect(getScoreValue({ ...score, total_score: undefined }, createUser(ScoreData.Lazer))).toBe(400);
        expect(getScoreValue({ ...score, total_score: undefined, score: undefined }, createUser(ScoreData.Lazer))).toBe(100);
    });

    test("uses API accuracy unless stable score data is selected", () => {
        const statistics = {
            count_300: 2,
            count_100: 1,
            count_50: 0,
            count_miss: 0,
        };

        expect(getScoreAccuracy(score, Mode.OSU, statistics, createUser(ScoreData.Stable))).toBeCloseTo(77.78, 2);
        expect(getScoreAccuracy(score, Mode.OSU, statistics, createUser(ScoreData.Lazer))).toBe(99);
        expect(getScoreAccuracy(score, Mode.OSU, statistics, createUser(null))).toBe(99);
        expect(getScoreAccuracy(score, Mode.OSU, statistics, null)).toBe(99);
    });

    test("chooses lazer performance rules from score data with legacy fallback", () => {
        expect(shouldUseLazerPerformance({ legacy_score_id: null, accuracy: 1 }, ScoreData.Stable)).toBe(false);
        expect(shouldUseLazerPerformance({ legacy_score_id: 123, accuracy: 1 }, ScoreData.Lazer)).toBe(true);
        expect(shouldUseLazerPerformance({ legacy_score_id: 123, accuracy: 1 }, null)).toBe(false);
        expect(shouldUseLazerPerformance({ legacy_score_id: null, accuracy: 1 }, null)).toBe(true);
        expect(shouldUseLazerPerformance(undefined, null)).toBe(true);
    });
});
