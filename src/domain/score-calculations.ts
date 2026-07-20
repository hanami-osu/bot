import { calculateClassicAccuracy } from "@utils/score-preference";
import { Mode, type Rank } from "@type/osu";

export const accuracyCalculator = calculateClassicAccuracy;

export function formatDuration(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
    const rounded = Math.round(totalSeconds);
    const seconds = rounded % 60;
    const minutesTotal = Math.floor(rounded / 60);
    const minutes = minutesTotal % 60;
    const hours = Math.floor(minutesTotal / 60);
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function gradeCalculator(
    mode: Mode,
    hits: {
        count_300?: number | null;
        count_100?: number | null;
        count_50?: number | null;
        count_miss?: number | null;
        count_geki?: number | null;
        count_katu?: number | null;
    },
    mods: Array<string>,
): Rank {
    const n300 = hits.count_300 ?? 0,
        n100 = hits.count_100 ?? 0,
        n50 = hits.count_50 ?? 0,
        nMiss = hits.count_miss ?? 0,
        nGeki = hits.count_geki ?? 0,
        nKatu = hits.count_katu ?? 0;
    const silver = mods.includes("hd") || mods.includes("HD") || mods.includes("fl") || mods.includes("FL");
    const ss: Rank = silver ? "SSH" : "SS",
        s: Rank = silver ? "SH" : "S";
    if (mode === Mode.OSU || mode === Mode.TAIKO) {
        const total = n300 + n100 + n50 + nMiss;
        if (!total || n300 / total === 1) return ss;
        if (n300 / total > 0.9 && n50 / total < 0.01 && nMiss === 0) return s;
        if ((n300 / total > 0.8 && nMiss === 0) || n300 / total > 0.9) return "A";
        if ((n300 / total > 0.7 && nMiss === 0) || n300 / total > 0.8) return "B";
        return n300 / total > 0.6 ? "C" : "D";
    }
    const total = mode === Mode.FRUITS ? n300 + n100 + n50 + nMiss + nKatu : n300 + n100 + n50 + nMiss + nGeki + nKatu;
    const accuracy =
        mode === Mode.FRUITS
            ? (n50 + n100 + n300) / (total || 1)
            : (n50 * 50 + n100 * 100 + nKatu * 200 + (n300 + nGeki) * 300) / ((total || 1) * 300);
    if (accuracy === 1) return ss;
    if (accuracy > (mode === Mode.FRUITS ? 0.98 : 0.95)) return s;
    if (accuracy > (mode === Mode.FRUITS ? 0.94 : 0.9)) return "A";
    if (accuracy > (mode === Mode.FRUITS ? 0.9 : 0.8)) return "B";
    return accuracy > (mode === Mode.FRUITS ? 0.85 : 0.7) ? "C" : "D";
}

const orders = ["count_geki", "count_300", "count_katu", "count_100", "count_50", "count_miss"] as const;
export function hitValueCalculator(
    mode: Mode,
    statistics: {
        count_300?: number;
        count_miss?: number;
        count_100?: number;
        count_50?: number;
        count_geki?: number | null;
        count_katu?: number | null;
    } | null,
): string {
    if (!statistics) return "";
    return orders
        .filter(
            (order) =>
                order !== "count_geki" &&
                !(order === "count_katu" && mode !== Mode.FRUITS && mode !== Mode.MANIA) &&
                !(order === "count_100" && mode === Mode.TAIKO),
        )
        .map((order) => statistics[order])
        .filter((value): value is number => value !== null && typeof value !== "undefined")
        .join("/");
}

export function getRetryCount(beatmapIds: Array<number>, mapId: number): number {
    return beatmapIds.filter((id) => id === mapId).length;
}
