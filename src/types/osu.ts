import type { Mod } from "./mods";
import type { Beatmap as BeatmapRosu, BeatmapAttributes, PerformanceAttributes } from "rosu-pp-js";
import type { v2_users_details, v2_beatmaps_details_difficulty } from "osu-api-extended";

export const enum Mode {
    OSU = "osu",
    MANIA = "mania",
    TAIKO = "taiko",
    FRUITS = "fruits",
}

export const enum PlayType {
    BEST = "best",
    RECENT = "recent",
    FIRSTS = "firsts",
}

export interface ProfileInfo {
    username: string;
    userCover: string;
    avatarUrl: string;
    userUrl: string;
    bannerUrl: string;
    flagUrl: string;
    countryCode: string;
    globalRank: string;
    countryRank: string;
    peakGlobalRank: string;
    peakGlobalRankTime: number;
    pp: string;
    rankedScore: string;
    totalScore: string;
    objectsHit: string;
    occupation: string | null;
    interest: string | null;
    location: string | null;
    recommendedStarRating: string;
    joinedAgo: string;
    joinedAt: string;
    accuracy: string;
    level: string;
    playCount: string;
    playHours: string;
    followers: string;
    maxCombo: string;
    rankS: string;
    rankA: string;
    rankSs: string;
    rankSh: string;
    rankSsh: string;
}

export interface ScoresInfo {
    position: number;
    songNameFormatted: string;
    songArtist: string;
    songName: string;
    retries: number | undefined;
    percentagePassed: string | null;
    difficultyName: string;
    score: string;
    accuracy: string;
    mapLink: string;
    coverLink: string;
    listLink: string;
    thumbLink: string;
    grade: string;
    hitValues: string;
    fcHitValues: string;
    fcAccuracy: string | undefined;
    isFc: boolean;
    mapAuthor: string;
    mapStatus: string;
    mods: Array<string>;
    drainLength: string;
    stars: string;
    rulesetEmote: string;
    pp: number;
    ppFormatted: string;
    playSubmitted: string;
    ifFcHanami: string | null;
    ifFcBathbot: string | null;
    ifFcOwo: string | null;
    comboValues: string;
    performance: PerformanceInfo;
    user: string | undefined;
    userId: number | undefined;
}

export interface PerformanceInfo {
    mapValues: BeatmapRosu;
    difficultyAttrs: BeatmapAttributes;
    perfect: PerformanceAttributes;
    current: PerformanceAttributes;
    fc: PerformanceAttributes;
    mapId: number;
    mods: Array<string>;
}

export type AuthScope = "public" | "chat.write" | "delegate" | "forum.write" | "friends.read" | "identify";

export interface AccessTokenJSON {
    access_token: string;
    expires_in: number;
}

export interface ScoreStatistics {
    count_300?: number;
    count_100?: number;
    count_50?: number;
    count_miss?: number;
    count_geki?: number | null;
    count_katu?: number | null;
    
    // v2 naming mappings
    perfect?: number | null;
    great?: number | null;
    good?: number;
    ignore_hit?: number;
    ignore_miss?: number;
    large_bonus?: number;
    large_tick_hit?: number;
    legacy_combo_increase?: number;
    meh?: number;
    miss?: number;
    ok?: number;
    small_bonus?: number;
    small_tick_hit?: number;
    small_tick_miss?: number;
    slider_tail_hit?: number;
}

export type ISOTimestamp = string;
export type Rank = "XH" | "X" | "SH" | "S" | "A" | "B" | "C" | "D" | "F" | "SSH" | "SS";
export type GameMode = "osu" | "taiko" | "fruits" | "mania" | string;

export interface Country { code: string; name: string }
export interface UserStatistics { grade_counts: Record<string, number>; }
export interface Cover { custom_url: string; url: string; id?: string }

// Re-use osu-api-extended's exact user details interface
export type UserExtended = v2_users_details.UsersDetailsResponse;

// Base Beatmap types needed by codebase
export type Beatmapset = {
    artist: string;
    title: string;
    creator: string;
    id: number;
    status: string;
    ratings?: Array<number>;
} & Record<string, any>;

export type Beatmap = v2_beatmaps_details_difficulty.beatmaps_details_difficulty_response & Record<string, any>;

// Unified Score type covering Leaderboard, UserBest, UserRecent
export type Score = {
    id: number;
    user_id: number;
    accuracy: number;
    max_combo: number;
    passed: boolean;
    pp: number | null;
    rank: Rank;
    score?: number;
    total_score?: number;
    legacy_score_id?: number | null;
    statistics: ScoreStatistics;
    beatmap: Beatmap;
    beatmapset: Beatmapset;
    created_at?: ISOTimestamp;
    ended_at?: ISOTimestamp;
    mods: Array<Mod> | Array<string>;
    position?: number;
    user?: {
        username: string;
    } & Record<string, any>;
} & Record<string, any>;

// Aliases for compatibility
export type UserScore = Score;
export type UserBestScore = Score;
export type UserScoreV2 = Score;
export type UserBestScoreV2 = Score;
export type ScoreV2 = Score;
export type LeaderboardScore = Score;

export interface LeaderboardScoresRaw {
    scores: Array<LeaderboardScore>;
}
