import { bulkInsertData } from "@utils/database";
import { Tables, type Score as ScoreDatabase } from "@type/database";
import type { Beatmap, Mode, Score, ScoreStatistics } from "@type/osu";

export function toScoreWrite(
    play: Score,
    mode: Mode,
    mapTemp?: Beatmap,
): { id: string; table: Tables; data: Array<{ key: keyof ScoreDatabase; value: number | string }> } {
    const beatmap = mapTemp ?? play.beatmap;
    const statistics: ScoreStatistics =
        "score" in play
            ? play.statistics
            : {
                  count_300: play.statistics.great ?? 0,
                  count_100: play.statistics.ok ?? 0,
                  count_50: play.statistics.meh ?? 0,
                  count_geki: play.statistics.perfect ?? 0,
                  count_katu: play.statistics.good ?? 0,
                  count_miss: play.statistics.miss ?? 0,
              };
    return {
        id: play.id.toString(),
        table: Tables.SCORE,
        data: [
            { key: "user_id", value: play.user_id.toString() },
            { key: "map_id", value: beatmap.id.toString() },
            { key: "gamemode", value: mode === "osu" ? 0 : mode === "taiko" ? 1 : mode === "fruits" ? 2 : 3 },
            {
                key: "mods",
                value: play.mods.map((m) => (typeof m === "object" && m !== null && "acronym" in m ? m.acronym : m)).join(""),
            },
            { key: "score", value: ("score" in play && play.score ? play.score : (play.total_score ?? 0)).toString() },
            { key: "accuracy", value: play.accuracy },
            { key: "max_combo", value: play.max_combo },
            { key: "grade", value: play.rank },
            { key: "count_50", value: statistics.count_50 ?? 0 },
            { key: "count_100", value: statistics.count_100 ?? 0 },
            { key: "count_300", value: statistics.count_300 ?? 0 },
            { key: "count_geki", value: statistics.count_geki ?? 0 },
            { key: "count_katu", value: statistics.count_katu ?? 0 },
            { key: "count_miss", value: statistics.count_miss ?? 0 },
            { key: "map_state", value: beatmap.status },
            { key: "ended_at", value: "created_at" in play && play.created_at ? play.created_at : (play.ended_at ?? "") },
        ],
    };
}

export function createScorePersistence({ writeBatch = bulkInsertData }: { writeBatch?: typeof bulkInsertData } = {}) {
    return {
        async saveScoreDatas(scores: Array<Score>, mode: Mode, mapTemp?: Beatmap): Promise<void> {
            const writes = scores.filter((score) => score.passed).map((score) => toScoreWrite(score, mode, mapTemp));
            if (writes.length) await writeBatch(writes);
        },
    };
}
export const scorePersistence = createScorePersistence();
export const saveScoreDatas = scorePersistence.saveScoreDatas;
