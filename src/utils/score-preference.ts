import { IDefaultParams as AddonParams } from "osu-api-extended";
import { ScoreData, type User } from "@type/database";
import { Mode, type ScoreStatistics } from "@type/osu";

export interface ScoreLike {
    accuracy: number;
    score?: number;
    total_score?: number;
    classic_total_score?: number;
    legacy_total_score?: number;
    legacy_score_id?: number | null;
}

type AccuracyHits = Pick<ScoreStatistics, "count_300" | "count_100" | "count_50" | "count_miss" | "count_geki" | "count_katu">;

export function getScoreData(authorDb: User | null): number | null {
    return typeof authorDb?.score_data === "number" ? authorDb.score_data : null;
}

export function getScoreFetchAddons(authorDb: User | null): AddonParams | undefined {
    const scoreData = getScoreData(authorDb);
    if (scoreData === null) return undefined;

    return {
        legacy_only: scoreData === ScoreData.Stable,
    };
}

export function getLegacyOnlyQueryValue(authorDb: User | null): "0" | "1" | undefined {
    const scoreData = getScoreData(authorDb);
    if (scoreData === null) return undefined;

    return scoreData === ScoreData.Stable ? "1" : "0";
}

export function getScoreValue(play: ScoreLike, authorDb: User | null): number {
    const legacyTotalScore
        = typeof play.legacy_total_score === "number" && play.legacy_total_score > 0 ? play.legacy_total_score : undefined;
    const classicTotalScore
        = typeof play.classic_total_score === "number" && play.classic_total_score > 0 ? play.classic_total_score : undefined;
    const totalScore = typeof play.total_score === "number" ? play.total_score : undefined;
    const score = typeof play.score === "number" ? play.score : undefined;

    if (authorDb?.score_data === ScoreData.Stable) {
        return legacyTotalScore ?? classicTotalScore ?? totalScore ?? score ?? 0;
    }

    return totalScore ?? score ?? legacyTotalScore ?? classicTotalScore ?? 0;
}

export function calculateClassicAccuracy(mode: Mode, hits: AccuracyHits): number {
    let {
        count_100: count100,
        count_300: count300,
        count_50: count50,
        count_geki: countGeki,
        count_katu: countKatu,
        count_miss: countMiss,
    } = hits;
    count100 ??= 0;
    count300 ??= 0;
    count50 ??= 0;
    countGeki ??= 0;
    countKatu ??= 0;
    countMiss ??= 0;

    let acc = 0.0;

    switch (mode) {
        case Mode.OSU:
            acc = (6 * count300 + 2 * count100 + count50) / (6 * (count50 + count100 + count300 + countMiss));
            break;
        case Mode.TAIKO:
            acc = (2 * count300 + count100) / (2 * (count300 + count100 + countMiss));
            break;
        case Mode.FRUITS:
            acc = (count300 + count100 + count50) / (count300 + count100 + count50 + countKatu + countMiss);
            break;
        case Mode.MANIA:
            acc
                = (6 * countGeki + 6 * count300 + 4 * countKatu + 2 * count100 + count50)
                    / (6 * (count50 + count100 + count300 + countMiss + countGeki + countKatu));
            break;
    }

    return Number.isFinite(acc) ? 100 * acc : 100;
}

export function getScoreAccuracy(play: ScoreLike, mode: Mode, scoreStatistics: ScoreStatistics, authorDb: User | null): number {
    if (authorDb?.score_data === ScoreData.Stable) {
        return calculateClassicAccuracy(mode, scoreStatistics);
    }

    return play.accuracy * 100;
}

export function shouldUseLazerPerformance(play?: ScoreLike | null, scoreData?: ScoreData | number | null): boolean {
    if (scoreData === ScoreData.Stable) return false;
    if (scoreData === ScoreData.Lazer) return true;

    if (play && play.legacy_score_id !== null && typeof play.legacy_score_id !== "undefined") {
        return false;
    }

    return true;
}
