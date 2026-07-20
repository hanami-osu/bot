import type { User } from "@type/database";
import type { Mode, PlayType, Score, UserExtended } from "@type/osu";

export const USER_SCORE_FETCH_LIMIT = 200;

export interface UserScoreQuery {
    query: {
        mode: Mode;
        limit: number;
        include_fails?: boolean;
    };
}

export interface BeatmapScoreQuery {
    query: {
        mode: Mode;
    };
}

/** Preferences are deliberately provider-neutral; Bancho maps them to its legacy query option. */
export type ScorePreferences = User | null;

export interface ScoreProvider {
    readonly id: string;
    getUser(identity: string | number, mode: Mode): Promise<UserExtended | null>;
    getUserScores(userId: number, type: PlayType, options: UserScoreQuery, preferences: ScorePreferences): Promise<Array<Score>>;
    getBeatmapUserScores(
        beatmapId: number,
        userId: number,
        options: BeatmapScoreQuery,
        preferences: ScorePreferences,
    ): Promise<Array<Score>>;
}
