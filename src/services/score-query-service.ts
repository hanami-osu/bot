import { banchoProvider } from "../providers/bancho-provider";
import type { BeatmapScoreQuery, ScorePreferences, ScoreProvider, UserScoreQuery } from "../providers/score-provider";
import type { PlayType, Score } from "@type/osu";

export function createScoreQueryService(provider: ScoreProvider = banchoProvider) {
    return {
        getUserScores(userId: number, type: PlayType, options: UserScoreQuery, preferences: ScorePreferences): Promise<Array<Score>> {
            return provider.getUserScores(userId, type, options, preferences);
        },
        getBeatmapUserScores(
            beatmapId: number,
            userId: number,
            options: BeatmapScoreQuery,
            preferences: ScorePreferences,
        ): Promise<Array<Score>> {
            return provider.getBeatmapUserScores(beatmapId, userId, options, preferences);
        },
    };
}

export const scoreQueryService = createScoreQueryService();
