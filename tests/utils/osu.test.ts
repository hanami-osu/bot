import { describe, expect, test } from "bun:test";
import { ScoreData } from "../../src/types/database";
import { shouldUseLazerPerformance } from "../../src/utils/osu";

function createPlay(legacyScoreId: number | null): Parameters<typeof shouldUseLazerPerformance>[0] {
    return { legacy_score_id: legacyScoreId } as Parameters<typeof shouldUseLazerPerformance>[0];
}

describe("osu utilities", () => {
    describe("shouldUseLazerPerformance", () => {
        test("stable config forces classic performance rules", () => {
            expect(shouldUseLazerPerformance(createPlay(null), ScoreData.Stable)).toBe(false);
        });

        test("lazer config forces lazer performance rules", () => {
            expect(shouldUseLazerPerformance(createPlay(123), ScoreData.Lazer)).toBe(true);
        });

        test("falls back to classic rules for legacy scores without config", () => {
            expect(shouldUseLazerPerformance(createPlay(123), null)).toBe(false);
        });

        test("falls back to lazer rules for non-legacy scores without config", () => {
            expect(shouldUseLazerPerformance(createPlay(null), null)).toBe(true);
        });
    });
});
