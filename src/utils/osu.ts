import { bulkInsertData, getEntry, insertData } from "@utils/database";
import { Mode } from "@type/osu";
import { Tables, type ScoreData } from "@type/database";
import { calculateClassicAccuracy, getLegacyOnlyQueryValue, shouldUseLazerPerformance } from "@utils/score-preference";
import { Beatmap, BeatmapAttributesBuilder, Performance, type BeatmapAttributes, type PerformanceAttributes } from "rosu-pp-js";
import { ChannelType } from "lilybird";
import https from "https";
import crypto from "crypto";
import type { Score as ScoreDatabase, User } from "@type/database";
import type { Message } from "@lilybird/transformers";
import type { Mod } from "@type/mods";
import type { PerformanceInfo, Score, LeaderboardScore, GameMode, Rank, ScoreStatistics, Beatmap as BeatmapWeb, LeaderboardScoresRaw } from "@type/osu";
import type { Client, Embed } from "lilybird";

const rulesetIds: Record<Mode, number> = {
    [Mode.OSU]: 0,
    [Mode.TAIKO]: 1,
    [Mode.FRUITS]: 2,
    [Mode.MANIA]: 3,
};

export async function getBeatmapTopScores({
    beatmapId,
    isGlobal,
    mode,
    mods,
    authorDb,
}: {
    beatmapId: number;
    isGlobal: boolean;
    mode: GameMode;
    mods: Array<string> | undefined;
    authorDb: User | null;
}): Promise<Array<LeaderboardScore>> {
    const url = new URL(`https://osu.ppy.sh/beatmaps/${beatmapId}/scores`);
    url.searchParams.append("mode", mode);
    url.searchParams.append("type", isGlobal ? "global" : "country");
    const legacyOnly = getLegacyOnlyQueryValue(authorDb);
    if (typeof legacyOnly !== "undefined") url.searchParams.append("legacy_only", legacyOnly);

    if (mods && mods.length > 0) {
        for (const mod of mods) {
            url.searchParams.append("mods[]", mod.toUpperCase());
        }
    }

    const req = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Cookie: `osu_session=${process.env.OSU_ACCESS_TOKEN}`,
        },
    });

    const data = (await req.json()) as unknown as LeaderboardScoresRaw;

    if (!req.ok) {
        throw new Error("Failed to fetch top scores");
    }

    const scores = data.scores;
    if (!Array.isArray(scores)) {
        throw new Error("Failed to fetch top scores or scores array is missing");
    }

    scores.forEach((r: any, index: number) => (r.index = index));

    return scores;
}

function isNewMods(mods: Array<Mod> | Array<string>): mods is Array<Mod> {
    return Array.isArray(mods) && mods.every((mod) => typeof mod === "object" && "acronym" in mod);
}

function getRulesetId(mode: GameMode | Mode | undefined): number | undefined {
    if (!mode) return undefined;
    return rulesetIds[mode as Mode];
}

export async function getPerformanceResults({
    play,
    setId,
    mode,
    beatmapId,
    maxCombo,
    accuracy,
    clockRate,
    mapSettings,
    hitValues,
    mods,
    mapData,
    passed,
    checksum,
    scoreData,
}: {
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
}): Promise<PerformanceInfo | null> {
    const isLazer = shouldUseLazerPerformance(play, scoreData);

    let rulesetId: number | undefined;
    if (typeof play !== "undefined" && typeof play.mode_int === "number") rulesetId = play.mode_int;
    else if (typeof play !== "undefined" && typeof play.ruleset_id === "number") rulesetId = play.ruleset_id;
    else if (typeof play !== "undefined") rulesetId = getRulesetId(play.mode as GameMode | undefined);
    rulesetId ??= getRulesetId(mode);
    rulesetId ??= setId;
    if (typeof rulesetId === "undefined") return null;

    checksum ??= play?.beatmap?.checksum;

    if (mapData && checksum) {
        const localHash = crypto.createHash("md5").update(mapData).digest("hex");
        if (localHash !== checksum) {
            mapData = undefined;
        }
    }

    if (!mapData) {
        const entry = await getEntry(Tables.MAP, beatmapId);
        mapData = entry?.data;
        if (mapData && checksum) {
            const localHash = crypto.createHash("md5").update(mapData).digest("hex");
            if (localHash !== checksum) {
                mapData = undefined;
            }
        }
    }

    if (!mapData) {
        try {
            mapData = (await downloadBeatmap(beatmapId)).contents;
        } catch {
            return null;
        }
    }
    if (!mapData) return null;

    let modsStringArray: Array<string> = [];
    let rosuMods: object | number;

    if (typeof mods === "number") {
        rosuMods = mods;
    } else if (isNewMods(mods)) {
        rosuMods = mods.map((mod) => {
            if (mod.settings) {
                return { acronym: mod.acronym, settings: mod.settings };
            }
            return { acronym: mod.acronym };
        });
        for (const mod of mods) {
            if (mod.acronym === "DT" && mod.settings?.speed_change) {
                clockRate = mod.settings.speed_change;
                modsStringArray.push(`${mod.acronym}(${clockRate}x)`);
                continue;
            }
            if (mod.acronym === "CL") continue;
            modsStringArray.push(mod.acronym);
        }
    } else {
        rosuMods = (mods as Array<string>).map((acronym) => ({ acronym }));
        modsStringArray = mods as Array<string>;
    }

    let beatmap: Beatmap;
    try {
        beatmap = new Beatmap(mapData);
        beatmap.convert(rulesetId);
    } catch {
        return null;
    }

    let difficultyAttrs: BeatmapAttributes;
    let perfect: PerformanceAttributes;
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

    const {
        count_100: n100,
        count_300: n300,
        count_50: n50,
        count_geki: nGeki,
        count_katu: nKatu,
        count_miss: misses,
        large_tick_hit: largeTickHits,
        small_tick_hit: smallTickHits,
        slider_tail_hit: sliderEndHits,
    } = hitValues ?? {};

    // Only calculate passedObjects for failed/incomplete plays.
    // For completed plays, rosu-pp determines object count from the beatmap.
    let passedObjects: number | undefined;
    if (passed === false && hitValues) {
        passedObjects = (hitValues.count_300 ?? 0) + (hitValues.count_100 ?? 0) + (hitValues.count_50 ?? 0) + (hitValues.count_miss ?? 0);
    }

    let current: PerformanceAttributes;
    let fc: PerformanceAttributes;
    try {
        current = new Performance(
            typeof accuracy === "undefined"
                ? {
                      lazer: isLazer,
                      mods: rosuMods,
                      n100,
                      n300,
                      n50,
                      nGeki: nGeki ?? undefined,
                      nKatu: nKatu ?? undefined,
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
                      nGeki: nGeki ?? undefined,
                      nKatu: nKatu ?? undefined,
                      misses: 0,
                      accuracy,
                      combo: perfect.difficulty.maxCombo,
                      clockRate,
                  }
                : {
                      lazer: isLazer,
                      mods: rosuMods,
                      misses: 0,
                      accuracy,
                      combo: perfect.difficulty.maxCombo,
                      clockRate,
                  },
        ).calculate(perfect);
    } catch {
        return null;
    }

    return {
        mapValues: beatmap,
        mapId: beatmapId,
        mods: modsStringArray.length > 0 ? modsStringArray : ["NM"],
        difficultyAttrs,
        perfect,
        current,
        fc,
    };
}

export async function downloadBeatmap(
    id: string | number,
    timeoutMs = 6000,
): Promise<{
    id: string | number;
    contents: string;
}> {
    const url = `https://osu.ppy.sh/osu/${id}`;

    return new Promise(function (resolve, reject) {
        const req = https
            .request(url, { method: "GET" }, function (response) {
                const chunks: Array<Uint8Array> = [];

                response.on("data", function (chunk: Uint8Array) {
                    chunks.push(chunk);
                });
                response.on("end", async function () {
                    const data = Buffer.concat(chunks).toString();
                    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Beatmap download failed with HTTP ${response.statusCode ?? "unknown"}`));
                        return;
                    }

                    if (!isPlausibleBeatmap(data)) {
                        reject(new Error("Beatmap download returned invalid .osu content"));
                        return;
                    }

                    await insertData({ table: Tables.MAP, id, data: [{ key: "data", value: data }] });
                    resolve({ id, contents: data });
                });
            })
            .on("error", reject);

        req.setTimeout(timeoutMs, function () {
            req.destroy();
            reject(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
        });

        req.end();
    });
}

export function isPlausibleBeatmap(contents: string): boolean {
    const trimmed = contents.trim();
    return trimmed.startsWith("osu file format v") && trimmed.includes("[HitObjects]") && trimmed.includes("[Metadata]") && !/^<!doctype html/i.test(trimmed) && !/^<html/i.test(trimmed);
}

export function formatDuration(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";

    const roundedSeconds = Math.round(totalSeconds);
    const seconds = roundedSeconds % 60;
    const totalMinutes = Math.floor(roundedSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const accuracyCalculator = calculateClassicAccuracy;

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
    let { count_100: n100, count_300: n300, count_50: n50, count_geki: nGeki, count_katu: nKatu, count_miss: nMiss } = hits;
    n100 ??= 0;
    n300 ??= 0;
    n50 ??= 0;
    nGeki ??= 0;
    nKatu ??= 0;
    nMiss ??= 0;

    const silver = mods.includes("hd") || mods.includes("HD") || mods.includes("fl") || mods.includes("FL");

    let total = 0;
    let acc = 0.0;

    let r300 = 0;
    let r50 = 0;

    let rank: Rank;

    switch (mode) {
        case Mode.OSU:
        case Mode.TAIKO:
            total = n300 + n100 + n50 + nMiss;
            if (total === 0) return silver ? "SSH" : "SS";

            r300 = n300 / total;
            r50 = n50 / total;

            if (r300 === 1) rank = silver ? "SSH" : "SS";
            else if (r300 > 0.9 && r50 < 0.01 && nMiss === 0) rank = silver ? "SH" : "S";
            else if ((r300 > 0.8 && nMiss === 0) || r300 > 0.9) rank = "A";
            else if ((r300 > 0.7 && nMiss === 0) || r300 > 0.8) rank = "B";
            else if (r300 > 0.6) rank = "C";
            else rank = "D";

            break;

        case Mode.FRUITS:
            total = n300 + n100 + n50 + nMiss + nKatu;
            acc = total > 0 ? (n50 + n100 + n300) / total : 1;

            if (acc === 1) rank = silver ? "SSH" : "SS";
            else if (acc > 0.98) rank = silver ? "SH" : "S";
            else if (acc > 0.94) rank = "A";
            else if (acc > 0.9) rank = "B";
            else if (acc > 0.85) rank = "C";
            else rank = "D";

            break;

        case Mode.MANIA:
            total = n300 + n100 + n50 + nMiss + nGeki + nKatu;
            acc = total > 0 ? (n50 * 50 + n100 * 100 + nKatu * 200 + (n300 + nGeki) * 300) / (total * 300) : 1;

            if (acc === 1) rank = silver ? "SSH" : "SS";
            else if (acc > 0.95) rank = silver ? "SH" : "S";
            else if (acc > 0.9) rank = "A";
            else if (acc > 0.8) rank = "B";
            else if (acc > 0.7) rank = "C";
            else rank = "D";

            break;
    }

    return rank;
}

const orders = ["count_geki", "count_300", "count_katu", "count_100", "count_50", "count_miss"];
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
    if (statistics === null) return "";

    let hitValues = "";
    for (const order of orders) {
        const value = statistics[order as keyof typeof statistics];

        if (order === "count_geki" || (order === "count_katu" && mode !== Mode.FRUITS && mode !== Mode.MANIA) || (order === "count_100" && mode === Mode.TAIKO)) continue;

        if (value !== null) {
            if (hitValues.length > 0) hitValues += "/";

            hitValues += value;
        }
    }

    return hitValues;
}

export async function saveScoreDatas(scores: Array<Score>, mode: Mode, mapTemp?: BeatmapWeb): Promise<void> {
    const scoresList = [];
    for (const score of scores) {
        if (score.passed) scoresList.push(saveScore(score, mode, mapTemp));
    }

    if (scoresList.length > 0) await bulkInsertData(scoresList);
}

function saveScore(
    play: Score,
    mode: Mode,
    mapTemp?: BeatmapWeb,
): {
    id: string;
    table: Tables;
    data: Array<{
        key: keyof ScoreDatabase;
        value: number | string;
    }>;
} {
    let beatmap;
    if (mapTemp) {
        beatmap = mapTemp;
    } else {
        const { beatmap: map } = play;
        beatmap = map;
    }

    let statistics: ScoreStatistics;
    if ("score" in play) {
        statistics = play.statistics;
    } else {
        statistics = {
            count_300: play.statistics.great ?? 0,
            count_100: play.statistics.ok ?? 0,
            count_50: play.statistics.meh ?? 0,
            count_geki: play.statistics.perfect ?? 0,
            count_katu: play.statistics.good ?? 0,
            count_miss: play.statistics.miss ?? 0,
        };
    }

    return {
        id: play.id.toString(),
        table: Tables.SCORE,
        data: [
            {
                key: "user_id",
                value: play.user_id.toString(),
            },
            {
                key: "map_id",
                value: beatmap.id.toString(),
            },
            {
                key: "gamemode",
                value: mode === "osu" ? 0 : mode === "taiko" ? 1 : mode === "fruits" ? 2 : mode === "mania" ? 3 : 0,
            },
            {
                key: "mods",
                value: play.mods.map((m) => (typeof m === "object" && m !== null && "acronym" in m ? m.acronym : m)).join(""),
            },
            {
                key: "score",
                value: ("score" in play && play.score ? play.score : (play.total_score ?? 0)).toString(),
            },
            {
                key: "accuracy",
                value: play.accuracy,
            },
            {
                key: "max_combo",
                value: play.max_combo,
            },
            {
                key: "grade",
                value: play.rank,
            },
            {
                key: "count_50",
                value: statistics.count_50 ?? 0,
            },
            {
                key: "count_100",
                value: statistics.count_100 ?? 0,
            },
            {
                key: "count_300",
                value: statistics.count_300 ?? 0,
            },
            {
                key: "count_geki",
                value: statistics.count_geki ?? 0,
            },
            {
                key: "count_katu",
                value: statistics.count_katu ?? 0,
            },
            {
                key: "count_miss",
                value: statistics.count_miss ?? 0,
            },
            {
                key: "map_state",
                value: beatmap.status,
            },
            {
                key: "ended_at",
                value: "created_at" in play && play.created_at ? play.created_at : (play.ended_at ?? ""),
            },
        ],
    };
}

function findId(embed: Embed.Structure): number | null {
    const urlToCheck = embed.url ?? embed.author?.url;
    if (!urlToCheck || /\/(user|u)/.test(urlToCheck)) return null;

    const beatmapMatch = /osu\.ppy\.sh\/(?:b|beatmaps)\/(\d+)/.exec(urlToCheck);
    return beatmapMatch ? Number(beatmapMatch[1]) : null;
}

function getEmbedFromReply(message: Message): number | null {
    const { referencedMessage } = message;
    if (typeof referencedMessage?.embeds === "undefined") {
        return null;
    }

    const foundId = findId(referencedMessage.embeds[0]);
    return foundId;
}

async function cycleThroughEmbeds({ client, message, channelId }: { message?: Message; channelId?: string; client: Client }): Promise<number | null> {
    const sourceChannelId = message?.channelId ?? channelId;
    if (!sourceChannelId) return null;

    const channel = await client.rest.getChannel(sourceChannelId);
    if (!channel.id || channel.type !== ChannelType.GUILD_TEXT) {
        return null;
    }

    const messages = await client.rest.getChannelMessages(channel.id, { limit: 10 });

    let beatmapId = null;
    for (const message of messages) {
        if (!(message.embeds.length > 0 && message.author.bot)) continue;

        beatmapId = findId(message.embeds[0]);
        if (beatmapId) break;
    }
    return beatmapId;
}

export async function getBeatmapIdFromContext({ client, message, channelId }: { message?: Message; client: Client; channelId?: string }): Promise<number | null> {
    return typeof message?.referencedMessage !== "undefined" ? getEmbedFromReply(message) : cycleThroughEmbeds({ message, client, channelId });
}

export function getRetryCount(beatmapIds: Array<number>, mapId: number): number {
    return beatmapIds.filter((id) => id === mapId).length;
}
