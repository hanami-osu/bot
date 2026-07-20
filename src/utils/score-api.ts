/** @deprecated Import a provider or service directly in new code. */
export { USER_SCORE_FETCH_LIMIT } from "../providers/bancho-provider";
import { banchoProvider } from "../providers/bancho-provider";
import type { BeatmapScoreQuery, ScorePreferences, UserScoreQuery } from "../providers/score-provider";
import type { PlayType, Score } from "@type/osu";

/** Compatibility surface for commands that have not yet moved to a service. */
export function getUserScores(
    userId: number,
    type: PlayType,
    options: UserScoreQuery,
    preferences: ScorePreferences,
): Promise<Array<Score>> {
    return banchoProvider.getUserScores(userId, type, options, preferences);
}

/** Compatibility surface for commands that have not yet moved to a service. */
export function getBeatmapUserScores(
    beatmapId: number,
    userId: number,
    options: BeatmapScoreQuery,
    preferences: ScorePreferences,
): Promise<Array<Score>> {
    return banchoProvider.getBeatmapUserScores(beatmapId, userId, options, preferences);
}
