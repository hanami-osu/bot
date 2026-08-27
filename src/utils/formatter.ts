import { accuracyCalculator, formatDuration, getPerformanceResults, getRetryCount, hitValueCalculator } from "@utils/osu";
import { grades, rulesets } from "@utils/constants";
import { insertData } from "@utils/database";
import { getScoreAccuracy, getScoreValue } from "@utils/score-preference";
import { Tables, type User } from "@type/database";
import type {
    Mode,
    UserScore,
    Beatmap,
    LeaderboardScore,
    ScoresInfo,
    Score,
    UserBestScore,
    UserBestScoreV2,
    UserScoreV2,
    ScoreV2,
    ProfileInfo,
    ScoreStatistics,
    UserExtended,
} from "@type/osu";

const rulesetModes: Record<number, Mode> = {
    0: "osu" as Mode,
    1: "taiko" as Mode,
    2: "fruits" as Mode,
    3: "mania" as Mode,
};

function getScoreMode(
    play: UserBestScore | UserBestScoreV2 | UserScore | UserScoreV2 | Score | ScoreV2 | LeaderboardScore,
    fallback: Mode,
): Mode {
    if (typeof play.mode_int === "number" && rulesetModes[play.mode_int]) return rulesetModes[play.mode_int];
    if (typeof play.ruleset_id === "number" && rulesetModes[play.ruleset_id]) return rulesetModes[play.ruleset_id];
    if (play.mode === "osu" || play.mode === "taiko" || play.mode === "fruits" || play.mode === "mania") return play.mode as Mode;
    return fallback;
}

function getScoreMods(mods: UserBestScore["mods"]): Array<string> {
    if (!Array.isArray(mods) || mods.length === 0) return ["NM"];
    return mods.map((mod) => (typeof mod === "string" ? mod : mod.acronym));
}

function getBeatmapObjectCount(
    beatmap: { count_circles?: number; count_sliders?: number; count_spinners?: number },
    fallback: number,
): number {
    const objects = (beatmap.count_circles ?? 0) + (beatmap.count_sliders ?? 0) + (beatmap.count_spinners ?? 0);
    return objects > 0 ? objects : Math.max(fallback, 1);
}

function getFallbackStars(beatmap: { difficulty_rating?: number }): string {
    const stars = beatmap.difficulty_rating;
    return typeof stars === "number" ? `${stars.toFixed(2).toLocaleString()}★` : "?★";
}

export async function getFormattedScore({
    scores,
    beatmap: map_,
    index,
    mode,
    mapData,
    authorDb,
}: {
    scores: Array<UserBestScore | UserBestScoreV2 | UserScore | UserScoreV2 | Score | ScoreV2 | LeaderboardScore>;
    beatmap?: Beatmap;
    index: number;
    mode: Mode;
    mapData?: string;
    authorDb?: User | null;
}): Promise<ScoresInfo> {
    const play = scores[index];
    const scoreMode = getScoreMode(play, mode);

    let beatmap;
    let beatmapset;
    if (map_) {
        const { beatmapset: mapset, ...rest } = map_;
        beatmap = { ...rest };
        beatmapset = mapset;
    } else {
        const { beatmap: map, beatmapset: set } = play as UserBestScore | UserScore;
        beatmap = map;
        beatmapset = set;
    }

    const scoreStatistics: ScoreStatistics = {
        count_300: play.statistics.count_300 ?? play.statistics.great ?? 0,
        count_100: play.statistics.count_100 ?? play.statistics.ok ?? 0,
        count_50: play.statistics.count_50 ?? play.statistics.meh ?? 0,
        count_geki: play.statistics.count_geki ?? play.statistics.perfect ?? 0,
        count_katu: play.statistics.count_katu ?? play.statistics.good ?? 0,
        count_miss: play.statistics.count_miss ?? play.statistics.miss ?? 0,
        large_tick_hit: play.statistics.large_tick_hit ?? 0,
        small_tick_hit: play.statistics.small_tick_hit ?? 0,
        slider_tail_hit: play.statistics.slider_tail_hit ?? 0,
    };
    let user: string | undefined;
    let userId: number | undefined;
    let retries: number | undefined;

    if ("beatmap" in play) {
        const beatmapIds = [];
        for (let i = index; i < scores.length; i++) {
            const score = scores[i];
            if ("beatmap" in score) beatmapIds.push(score.beatmap.id);
        }
        retries = getRetryCount(beatmapIds, play.beatmap.id);
    }

    const totalScore = getScoreValue(play, authorDb ?? null);
    const accuracy = getScoreAccuracy(play, scoreMode, scoreStatistics, authorDb ?? null);
    const createdAt = play.created_at ?? play.ended_at ?? "";

    if ("user" in play && play.user) {
        user = play.user.username;
        userId = play.user_id;
    }

    const objectsHit =
        (scoreStatistics.count_300 ?? 0) +
        (scoreStatistics.count_100 ?? 0) +
        (scoreStatistics.count_50 ?? 0) +
        (scoreStatistics.count_miss ?? 0) +
        (scoreStatistics.count_geki ?? 0) +
        (scoreStatistics.count_katu ?? 0);

    const performance = await getPerformanceResults({
        hitValues: scoreStatistics,
        beatmapId: beatmap.id,
        play: play as any,
        mode: scoreMode,
        maxCombo: play.max_combo,
        passed: play.passed,
        mods: play.mods as any,
        mapData,
        checksum: beatmap.checksum,
        scoreData: authorDb?.score_data ?? null,
    });

    if (performance && play.passed && "score" in play) {
        await insertData(
            {
                table: Tables.PP,
                id: play.id,
                data: [
                    {
                        key: "pp",
                        value: performance.current.pp,
                    },
                    {
                        key: "pp_fc",
                        value: performance.fc.pp,
                    },
                    {
                        key: "pp_perfect",
                        value: performance.perfect.pp,
                    },
                ],
            },
            true,
        );
    }

    const hitValues = hitValueCalculator(scoreMode, scoreStatistics);

    const playMaxCombo = play.max_combo;
    const maxCombo = performance?.current.difficulty.maxCombo ?? beatmap.max_combo ?? playMaxCombo;
    const isFc = scoreStatistics.count_miss === 0 && playMaxCombo + 7 >= maxCombo;

    // set value to null because we won't always need it.
    let ifFcHanami: string | null = null;
    let ifFcBathbot: string | null = null;
    let ifFcOwo: string | null = null;
    let fcAccuracy: number | null = null;

    let fcStatistics: null | {
        count_300?: number;
        count_miss?: number;
        count_100?: number;
        count_50?: number;
        count_geki?: number;
        count_katu?: number;
    } = null;

    if (!isFc && performance) {
        fcStatistics = {
            count_300: performance.fc.state?.n300,
            count_100: performance.fc.state?.n100,
            count_50: performance.fc.state?.n50,
            count_miss: performance.fc.state?.misses,
            count_geki: performance.fc.state?.nGeki,
            count_katu: performance.fc.state?.nKatu,
        };

        fcAccuracy = accuracyCalculator(scoreMode, fcStatistics);
        ifFcHanami = `FC: **${performance.fc.pp.toFixed(2).toLocaleString()}pp** for **${fcAccuracy.toFixed(2)}%**`;
        ifFcBathbot = `**${performance.fc.pp.toFixed(2).toLocaleString()}**/${performance.perfect.pp.toFixed(2).toLocaleString()}PP`;
        ifFcOwo = `(${performance.fc.pp.toFixed(2).toLocaleString()}PP for ${fcAccuracy.toFixed(2)}% FC)`;
    }

    const fcHitValues = hitValueCalculator(scoreMode, fcStatistics);

    // get beatmap's drain length
    const drainLength = formatDuration(beatmap.total_length / (performance?.difficultyAttrs.clockRate ?? 1));

    const objects = performance?.mapValues.nObjects ?? getBeatmapObjectCount(beatmap, objectsHit);

    const percentageNum = (objectsHit / objects) * 100;
    const beatmapStatus = beatmapset.status;
    const onlinePp = typeof play.pp === "number" ? play.pp : undefined;
    const pp = onlinePp ?? performance?.current.pp ?? 0;

    return {
        user,
        userId,
        retries,
        position: play.position ?? index + 1,
        percentagePassed: percentageNum === 100 || play.passed ? null : percentageNum.toFixed(1),
        songNameFormatted: `${beatmapset.artist} - ${beatmapset.title}`,
        songArtist: beatmapset.artist,
        songName: beatmapset.title,
        difficultyName: beatmap.version,
        score: totalScore.toLocaleString(),
        accuracy: accuracy.toFixed(2),
        mapLink: `https://osu.ppy.sh/b/${beatmap.id}`,
        coverLink: `https://assets.ppy.sh/beatmaps/${beatmapset.id}/covers/cover.jpg`,
        listLink: `https://assets.ppy.sh/beatmaps/${beatmapset.id}/covers/list.jpg`,
        thumbLink: `https://b.ppy.sh/thumb/${beatmapset.id}l.jpg`,
        grade: grades[play.rank] ?? grades["F"],
        hitValues, // Returns the value in this format: { 433/12/2/4 }
        fcHitValues,
        fcAccuracy: fcAccuracy?.toFixed(2),
        isFc,
        mods: performance?.mods ?? getScoreMods(play.mods),
        mapAuthor: beatmapset.creator,
        mapStatus: beatmapStatus.charAt(0).toUpperCase() + beatmapStatus.slice(1),
        drainLength,
        stars: performance ? `${performance.current.difficulty.stars.toFixed(2).toLocaleString()}★` : getFallbackStars(beatmap),
        rulesetEmote: rulesets[scoreMode],
        pp,
        ppFormatted:
            onlinePp !== undefined
                ? performance
                    ? `**${onlinePp.toFixed(2).toLocaleString()}**/${performance.perfect.pp.toFixed(2).toLocaleString()}pp`
                    : `**${onlinePp.toFixed(2).toLocaleString()}pp**`
                : performance
                  ? `**${performance.current.pp.toFixed(2).toLocaleString()}**/${performance.perfect.pp.toFixed(2).toLocaleString()}pp`
                  : "PP unavailable",
        playSubmitted: `<t:${new Date(createdAt).getTime() / 1000}:R>`,
        ifFcHanami,
        ifFcBathbot,
        ifFcOwo,
        comboValues: `**${playMaxCombo.toLocaleString()}**/${maxCombo.toLocaleString()}x`,
        performance,
    };
}

export function getFormattedProfile(user: UserExtended, mode: Mode): ProfileInfo {
    const { statistics } = user;
    const userJoinDate = new Date(user.join_date);

    return {
        username: user.username,
        userCover: user.cover.url,
        avatarUrl: user.avatar_url,
        userUrl: `https://osu.ppy.sh/users/${user.id}/${mode}`,
        bannerUrl: user.cover.url,
        flagUrl: `https://osu.ppy.sh/images/flags/${user.country_code}.png`,
        countryCode: user.country.code,
        globalRank: statistics.global_rank?.toLocaleString() ?? "-",
        countryRank: statistics.country_rank?.toLocaleString() ?? "-",
        peakGlobalRank: user.rank_highest?.rank.toLocaleString() ?? "",
        peakGlobalRankTime: new Date(user.rank_highest?.updated_at ?? 0).getTime() / 1000,
        pp: statistics.pp.toLocaleString(),
        accuracy: statistics.hit_accuracy.toFixed(2),
        level: `${user.statistics.level.current}.${statistics.level.progress.toString(10).padStart(2, "0")}`,
        playCount: statistics.play_count.toLocaleString(),
        playHours: (statistics.play_time / 3600).toFixed(0),
        followers: user.follower_count.toLocaleString(),
        maxCombo: statistics.maximum_combo.toLocaleString(),
        rankedScore: statistics.ranked_score.toLocaleString(),
        totalScore: statistics.total_score.toLocaleString(),
        objectsHit: statistics.total_hits.toLocaleString(),
        occupation: user.occupation ?? null,
        interest: user.interests,
        location: user.location,
        recommendedStarRating: (Math.pow(statistics.pp, 0.4) * 0.195).toFixed(2),
        joinedAgo: (Math.floor((Date.now() - userJoinDate.valueOf()) / (1000 * 60 * 60 * 24 * 30)) / 12).toFixed(1),
        joinedAt: userJoinDate.toLocaleDateString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            timeZone: "UTC",
        }),
        rankS: statistics.grade_counts.s.toLocaleString(),
        rankA: statistics.grade_counts.a.toLocaleString(),
        rankSs: statistics.grade_counts.ss.toLocaleString(),
        rankSh: statistics.grade_counts.sh.toLocaleString(),
        rankSsh: statistics.grade_counts.ssh.toLocaleString(),
    };
}
