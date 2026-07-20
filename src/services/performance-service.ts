import { Beatmap, BeatmapAttributesBuilder, Performance, type BeatmapAttributes, type PerformanceAttributes } from "rosu-pp-js";
import { shouldUseLazerPerformance } from "@utils/score-preference";
import { beatmapService, matchesChecksum } from "./beatmap-service";
import type { ScoreData } from "@type/database";
import type { PerformanceInfo, Score, LeaderboardScore, GameMode, Mode } from "@type/osu";
import type { Mod } from "@type/mods";

const rulesetIds: Record<Mode, number> = { osu: 0, taiko: 1, fruits: 2, mania: 3 };
function getRulesetId(mode: GameMode | Mode | undefined): number | undefined {
    return mode ? rulesetIds[mode as Mode] : undefined;
}
function isNewMods(mods: Array<Mod> | Array<string>): mods is Array<Mod> {
    return mods.every((mod) => typeof mod === "object" && "acronym" in mod);
}

export interface PerformanceRequest {
    play?: Score | LeaderboardScore;
    setId?: number;
    mode?: GameMode | Mode;
    beatmapId: number;
    maxCombo?: number;
    accuracy?: number;
    clockRate?: number;
    mapSettings?: { ar?: number; od?: number; cs?: number };
    hitValues?: {
        count_100?: number;
        count_300?: number;
        count_50?: number;
        count_geki?: number | null;
        count_katu?: number | null;
        count_miss?: number;
        large_tick_hit?: number;
        small_tick_hit?: number;
        slider_tail_hit?: number;
    };
    mods: Array<string> | Array<Mod> | number;
    mapData?: string;
    passed?: boolean;
    checksum?: string;
    scoreData?: ScoreData | number | null;
}

export function createPerformanceService({
    getBeatmapContents = beatmapService.getBeatmapContents,
}: { getBeatmapContents?: (id: number, checksum?: string) => Promise<string> } = {}) {
    return {
        async getPerformanceResults(request: PerformanceRequest): Promise<PerformanceInfo | null> {
            const {
                play,
                setId,
                mode,
                beatmapId,
                maxCombo,
                accuracy,
                clockRate: inputClockRate,
                mapSettings,
                hitValues,
                mods,
                passed,
                scoreData,
            } = request;
            let clockRate = inputClockRate;
            const isLazer = shouldUseLazerPerformance(play, scoreData);
            const rulesetId =
                typeof play?.mode_int === "number"
                    ? play.mode_int
                    : typeof play?.ruleset_id === "number"
                      ? play.ruleset_id
                      : (getRulesetId(play?.mode) ?? getRulesetId(mode) ?? setId);
            if (typeof rulesetId === "undefined") return null;
            let mapData = request.mapData;
            if (mapData && !matchesChecksum(mapData, request.checksum ?? play?.beatmap?.checksum)) mapData = undefined;
            try {
                mapData ??= await getBeatmapContents(beatmapId, request.checksum ?? play?.beatmap?.checksum);
            } catch {
                return null;
            }
            let modsStringArray: Array<string> = [];
            let rosuMods: object | number;
            if (typeof mods === "number") rosuMods = mods;
            else if (isNewMods(mods)) {
                rosuMods = mods.map((mod) =>
                    mod.settings ? { acronym: mod.acronym, settings: mod.settings } : { acronym: mod.acronym },
                );
                for (const mod of mods) {
                    if (mod.acronym === "DT" && mod.settings?.speed_change) {
                        clockRate = mod.settings.speed_change;
                        modsStringArray.push(`${mod.acronym}(${clockRate}x)`);
                    } else if (mod.acronym !== "CL") modsStringArray.push(mod.acronym);
                }
            } else {
                rosuMods = mods.map((acronym) => ({ acronym }));
                modsStringArray = mods;
            }
            let beatmap: Beatmap;
            try {
                beatmap = new Beatmap(mapData);
                beatmap.convert(rulesetId);
            } catch {
                return null;
            }
            let difficultyAttrs: BeatmapAttributes, perfect: PerformanceAttributes;
            try {
                difficultyAttrs = new BeatmapAttributesBuilder({
                    map: beatmap,
                    ar: mapSettings?.ar,
                    cs: mapSettings?.cs,
                    od: mapSettings?.od,
                    mods: rosuMods,
                    clockRate,
                }).build();
                perfect = new Performance({
                    lazer: isLazer,
                    ar: mapSettings?.ar,
                    cs: mapSettings?.cs,
                    od: mapSettings?.od,
                    mods: rosuMods,
                    clockRate,
                }).calculate(beatmap);
            } catch {
                return null;
            }
            const n100 = hitValues?.count_100,
                n300 = hitValues?.count_300,
                n50 = hitValues?.count_50,
                nGeki = hitValues?.count_geki ?? undefined,
                nKatu = hitValues?.count_katu ?? undefined,
                misses = hitValues?.count_miss,
                largeTickHits = hitValues?.large_tick_hit,
                smallTickHits = hitValues?.small_tick_hit,
                sliderEndHits = hitValues?.slider_tail_hit;
            const passedObjects = passed === false && hitValues ? (n300 ?? 0) + (n100 ?? 0) + (n50 ?? 0) + (misses ?? 0) : undefined;
            let current: PerformanceAttributes, fc: PerformanceAttributes;
            try {
                current = new Performance(
                    typeof accuracy === "undefined"
                        ? {
                              lazer: isLazer,
                              mods: rosuMods,
                              n100,
                              n300,
                              n50,
                              nGeki,
                              nKatu,
                              misses,
                              largeTickHits,
                              smallTickHits,
                              sliderEndHits,
                              combo: maxCombo ?? perfect.difficulty.maxCombo,
                              passedObjects,
                              clockRate,
                          }
                        : {
                              lazer: isLazer,
                              mods: rosuMods,
                              accuracy,
                              misses,
                              largeTickHits,
                              smallTickHits,
                              sliderEndHits,
                              combo: maxCombo ?? perfect.difficulty.maxCombo,
                              passedObjects,
                              clockRate,
                          },
                ).calculate(perfect);
                fc = new Performance(
                    typeof accuracy === "undefined"
                        ? {
                              lazer: isLazer,
                              mods: rosuMods,
                              n100,
                              n50,
                              nGeki,
                              nKatu,
                              misses: 0,
                              accuracy,
                              combo: perfect.difficulty.maxCombo,
                              clockRate,
                          }
                        : { lazer: isLazer, mods: rosuMods, misses: 0, accuracy, combo: perfect.difficulty.maxCombo, clockRate },
                ).calculate(perfect);
            } catch {
                return null;
            }
            return {
                mapValues: beatmap,
                mapId: beatmapId,
                mods: modsStringArray.length ? modsStringArray : ["NM"],
                difficultyAttrs,
                perfect,
                current,
                fc,
            };
        },
    };
}

export const performanceService = createPerformanceService();
export const getPerformanceResults = performanceService.getPerformanceResults;
