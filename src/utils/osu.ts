import { bulkInsertData, getEntry, insertData } from "@utils/database";
import { Mode } from "@type/osu";
import { Tables } from "@type/database";
import { Beatmap, BeatmapAttributesBuilder, Performance } from "rosu-pp-js";
import { enums } from "osu-api-extended";
import { ChannelType } from "lilybird";
import https from "https";
import type { Score as ScoreDatabase } from "@type/database";
import type { Message } from "@lilybird/transformers";
import type { Mod } from "@type/mods";
import type { PerformanceInfo, Score, LeaderboardScore, GameMode, Rank, ScoreStatistics, Beatmap as BeatmapWeb, LeaderboardScoresRaw } from "@type/osu";
import type { Client, Embed } from "lilybird";

function getModsEnum(mods: Array<string>, derivativeModsWithOriginal?: boolean): number {
    return mods.reduce((count, mod) => {
        if (
            !["NF", "EZ", "TD", "HD", "HR", "SD", "DT", "RX", "HT", "NC", "FL", "AT", "SO", "AP", "PF", "4K", "5K", "6K", "7K", "8K", "FI", "RD", "CN", "TP", "K9", "KC", "1K", "2K", "3K", "SV2", "MR"].includes(
                mod,
            )
        )
            return count;

        if (mod === "NC" && derivativeModsWithOriginal) return count + enums.ModsEnum.NC + enums.ModsEnum.DT;

        if (mod === "PF" && derivativeModsWithOriginal) return count + enums.ModsEnum.PF + enums.ModsEnum.SD;

        return count + enums.ModsEnum[mod as keyof typeof enums.ModsEnum];
    }, 0);
}

export async function getBeatmapTopScores({ beatmapId, isGlobal, mode, mods }: { beatmapId: number; isGlobal: boolean; mode: GameMode; mods: Array<string> | undefined }): Promise<Array<LeaderboardScore>> {
    const url = new URL(`https://osu.ppy.sh/beatmaps/${beatmapId}/scores`);
    url.searchParams.append("mode", mode);
    url.searchParams.append("type", isGlobal ? "global" : "country");

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

export async function getPerformanceResults({
    play,
    setId,
    beatmapId,
    maxCombo,
    accuracy,
    clockRate,
    mapSettings,
    hitValues,
    mods,
    mapData,
    objectsHit,
}: {
    play?: Score | LeaderboardScore;
    setId?: number;
    beatmapId: number;
    maxCombo?: number;
    accuracy?: number;
    clockRate?: number;
    mapSettings?: { ar?: number; od?: number; cs?: number };
    hitValues?: { count_100?: number; count_300?: number; count_50?: number; count_geki?: number | null; count_katu?: number | null; count_miss?: number };
    mods: Array<string> | Array<Mod> | number;
    mapData?: string;
    objectsHit?: number;
}): Promise<PerformanceInfo | null> {
    let rulesetId: number;
    if (typeof play !== "undefined" && "mode_int" in play) rulesetId = play.mode_int;
    else if (typeof play !== "undefined" && "mode" in play) rulesetId = play.ruleset_id;
    else rulesetId = setId!;

    mapData ??= (await getEntry(Tables.MAP, beatmapId))?.data ?? (await downloadBeatmap(beatmapId)).contents;
    if (!mapData) return null;

    let modsStringArray: Array<string> = [];
    let modsInt: number;
    if (typeof mods === "number") modsInt = mods;
    else if (isNewMods(mods)) {
        modsInt = getModsEnum(
            mods.map((x) => x.acronym),
            true,
        );
        for (const mod of mods) {
            if (mod.acronym === "DT" && mod.settings?.speed_change) {
                clockRate = mod.settings.speed_change;
                modsStringArray.push(`${mod.acronym}(${clockRate}x)`);
                continue;
            }
            modsStringArray.push(mod.acronym);
        }
    } else {
        modsInt = getModsEnum(mods as Array<string>, true);
        modsStringArray = mods as Array<string>;
    }

    const beatmap = new Beatmap(mapData);
    beatmap.convert(rulesetId);

    const difficultyAttrs = new BeatmapAttributesBuilder({
        map: beatmap,
        ar: mapSettings?.ar,
        cs: mapSettings?.cs,
        od: mapSettings?.od,
        mods: modsInt,
        clockRate,
    }).build();

    const perfect = new Performance({
        ar: mapSettings?.ar,
        cs: mapSettings?.cs,
        od: mapSettings?.od,
        mods: modsInt,
        clockRate,
    }).calculate(beatmap);

    const { count_100: n100, count_300: n300, count_50: n50, count_geki: nGeki, count_katu: nKatu, count_miss: misses } = hitValues ?? {};

    const current = new Performance(
        typeof accuracy === "undefined"
            ? {
                  mods: modsInt,
                  n100,
                  n300,
                  n50,
                  nGeki: nGeki ?? undefined,
                  nKatu: nKatu ?? undefined,
                  misses,
                  combo: maxCombo ?? perfect.difficulty.maxCombo,
                  passedObjects: objectsHit,
                  clockRate,
              }
            : {
                  mods: modsInt,
                  accuracy,
                  misses,
                  combo: maxCombo ?? perfect.difficulty.maxCombo,
                  passedObjects: objectsHit,
                  clockRate,
              },
    ).calculate(perfect);

    const fc = new Performance(
        typeof accuracy === "undefined"
            ? {
                  mods: modsInt,
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
                  mods: modsInt,
                  misses: 0,
                  accuracy,
                  combo: perfect.difficulty.maxCombo,
                  clockRate,
              },
    ).calculate(perfect);

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

export function accuracyCalculator(
    mode: Mode,
    hits: {
        count_300?: number | null;
        count_100?: number | null;
        count_50?: number | null;
        count_miss?: number | null;
        count_geki?: number | null;
        count_katu?: number | null;
    },
): number {
    let { count_100: count100, count_300: count300, count_50: count50, count_geki: countGeki, count_katu: countKatu, count_miss: countMiss } = hits;
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
            acc = count300 + count100 + count50 + countKatu + countMiss;
            break;
        case Mode.MANIA:
            acc = (6 * countGeki + 6 * count300 + 4 * countKatu + 2 * count100 + count50) / (6 * (count50 + count100 + count300 + countMiss + countGeki + countKatu));
            break;
    }

    return 100 * acc;
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
    id: number;
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
        id: play.id,
        table: Tables.SCORE,
        data: [
            {
                key: "user_id",
                value: play.user_id,
            },
            {
                key: "map_id",
                value: beatmap.id,
            },
            {
                key: "gamemode",
                value: mode === "osu" ? 0 : mode === "taiko" ? 1 : mode === "fruits" ? 2 : mode === "mania" ? 3 : 0,
            },
            {
                key: "mods",
                value: play.mods.map(m => typeof m === "object" && m !== null && "acronym" in m ? m.acronym : m).join(""),
            },
            {
                key: "score",
                value: "score" in play && play.score ? play.score : (play.total_score ?? 0),
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
    return urlToCheck && !/\/(user|u)/.test(urlToCheck) ? Number(/\d+/.exec(urlToCheck)?.[0]) : null;
}

function getEmbedFromReply(message: Message): number | null {
    const { referencedMessage } = message;
    if (typeof referencedMessage?.embeds === "undefined") {
        return null;
    }

    const foundId = findId(referencedMessage.embeds[0]);
    return Number(foundId) || null;
}

async function cycleThroughEmbeds({ client, message, channelId }: { message?: Message; channelId?: string; client: Client }): Promise<number | null> {
    const channel = await client.rest.getChannel(message?.channelId ?? channelId ?? "");
    if (!channel.id || channel.type !== ChannelType.GUILD_TEXT) {
        return null;
    }

    const messages = await client.rest.getChannelMessages(channel.id, { limit: 100 });

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
