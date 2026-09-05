import type { DifficultyOptions } from "./command-args";
import type { User } from "./database";
import type {
    Beatmap,
    LeaderboardScore,
    Mode,
    Score,
    UserBestScoreV2,
    UserScoreV2,
    ScoreV2,
    UserBestScore,
    UserScore,
    ProfileInfo,
    ScoresInfo,
} from "./osu";
import type { UserExtended } from "./osu";
import type { Mod } from "./mods";
import type { WhatIfProjection } from "@utils/whatif";
import type { v2_beatmaps_details_set } from "osu-api-extended";

export const enum EmbedBuilderType {
    COMPARE = "compareBuilder",
    LEADERBOARD = "leaderboardBuilder",
    MAP = "mapBuilder",
    MAPSET = "mapsetBuilder",
    PLAYS = "playBuilder",
    PROFILE = "profileBuilder",
    AVATAR = "avatarBuilder",
    BACKGROUND = "backgroundBuilder",
    BANNER = "bannerBuilder",
    SIMULATE = "simulateBuilder",
    WHATIF = "whatIfBuilder",
}

export interface ModStructure {
    exclude: null | boolean;
    include: null | boolean;
    forceInclude: null | boolean;
    name: null | Mod | string;
}

export interface BuilderOptions {
    type: EmbedBuilderType;
    initiatorId: string;
}

export interface CompareBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.COMPARE;
    beatmap: Beatmap;
    plays: Array<Score | ScoreV2>;
    user: UserExtended;
    mode: Mode;
    authorDb: User | null;
    mods?: ModStructure;
    page?: number;
}

export interface LeaderboardBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.LEADERBOARD;
    scores: Array<LeaderboardScore>;
    beatmap: Beatmap;
    authorDb: User | null;
    page: number | undefined;
}

export interface SimulateBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.SIMULATE;
    beatmapId: number;
    mods: Array<string> | Array<Mod> | null;
    options: DifficultyOptions;
}

export interface BeatmapBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.MAP;
    beatmapId: number;
    mods: Array<Mod> | null;
}

type BeatmapsetResponse = v2_beatmaps_details_set.beatmaps_details_set_response;
type BeatmapsetDifficulty = BeatmapsetResponse["beatmaps"][number];

export type BeatmapsetBuilderDifficulty = Pick<
    BeatmapsetDifficulty,
    | "id"
    | "mode"
    | "version"
    | "difficulty_rating"
    | "total_length"
    | "bpm"
    | "accuracy"
    | "ar"
    | "cs"
    | "drain"
    | "count_circles"
    | "count_sliders"
    | "count_spinners"
    | "max_combo"
>;

export type BeatmapsetBuilderSet = Pick<
    BeatmapsetResponse,
    "id" | "artist" | "title" | "creator" | "status" | "user_id" | "favourite_count" | "play_count"
> & { beatmaps: Array<BeatmapsetBuilderDifficulty> };

export interface BeatmapsetBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.MAPSET;
    beatmapset: BeatmapsetBuilderSet;
    mods: Array<Mod> | null;
    page: number;
    selectedBeatmapId?: number;
}

export interface PlayPaginationOptions extends BuilderOptions {
    plays: Array<UserBestScore | UserScore | UserBestScoreV2 | UserScoreV2>;
    type: EmbedBuilderType.PLAYS;
    user: UserExtended;
    mode: Mode;
    authorDb: User | null;
    index?: number;
    isMultiple?: boolean;
    sortByDate?: boolean;
    page?: number;
    isPage?: boolean;
    mods?: ModStructure;
    titleFilter?: string;
}

export interface PlaysBuilderOptions {
    profile: ProfileInfo;
    plays: Array<ScoresInfo>;
    mode: Mode;
    authorDb: User | null;
    totalPlays: number;
    index?: number;
    isMultiple?: boolean;
    page?: number;
}

export interface ProfileBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.PROFILE;
    user: UserExtended;
    mode: Mode;
}

export interface AvatarBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.AVATAR;
    user: UserExtended;
}

export interface BackgroundBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.BACKGROUND;
    beatmap: Beatmap;
}

export interface BannerBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.BANNER;
    user: UserExtended;
    mode: Mode;
}

export interface WhatIfBuilderOptions extends BuilderOptions {
    type: EmbedBuilderType.WHATIF;
    user: UserExtended;
    mode: Mode;
    projection: WhatIfProjection;
    projectedRank: number | null;
}

export type EmbedBuilderOptions
    = | CompareBuilderOptions
        | LeaderboardBuilderOptions
        | BeatmapBuilderOptions
        | BeatmapsetBuilderOptions
        | PlayPaginationOptions
        | ProfileBuilderOptions
        | AvatarBuilderOptions
        | BackgroundBuilderOptions
        | BannerBuilderOptions
        | SimulateBuilderOptions
        | WhatIfBuilderOptions;
