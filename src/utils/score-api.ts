/** @deprecated Import a provider or service directly in new code. */
export { USER_SCORE_FETCH_LIMIT } from "../providers/bancho-provider";
import type { BeatmapScoreQuery, ScorePreferences, UserScoreQuery } from "../providers/score-provider";
import type { PlayType, Score } from "@type/osu";
import { scoreQueryService } from "../services/score-query-service";

const banchoIdentity = { provider: "bancho" as const, externalId: "" };

/** Compatibility surface for commands that have not yet moved to a service. */
export function getUserScores(
    userId: number,
    type: PlayType,
    options: UserScoreQuery,
    preferences: ScorePreferences,
): Promise<Array<Score>> {
    return scoreQueryService.getUserScores(banchoIdentity, userId, type, options, preferences);
}

/** Compatibility surface for commands that have not yet moved to a service. */
export function getBeatmapUserScores(
    beatmapId: number,
    userId: number,
    options: BeatmapScoreQuery,
    preferences: ScorePreferences,
): Promise<Array<Score>> {
    return scoreQueryService.getBeatmapUserScores(banchoIdentity, beatmapId, userId, options, preferences);
}
