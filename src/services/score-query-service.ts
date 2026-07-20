import type { BeatmapScoreQuery, ScorePreferences, UserScoreQuery } from "../providers/score-provider";
import type { PlayType, Score } from "@type/osu";
import { providerRegistry, type ProviderRegistry } from "../providers/provider-registry";
import type { ExternalIdentity } from "@type/external-identity";

export function createScoreQueryService(registry: ProviderRegistry = providerRegistry) {
    return {
        // TODO: For Bancho identities, normalize and compare Bancho and Hanami scores here (not banchoProvider); a newer Hanami recent may win, while best, first-place, and beatmap aggregation stay undefined.
        getUserScores(
            identity: ExternalIdentity,
            userId: number,
            type: PlayType,
            options: UserScoreQuery,
            preferences: ScorePreferences,
        ): Promise<Array<Score>> {
            const provider = registry.get(identity.provider);
            return provider.getUserScores(userId, type, options, preferences);
        },
        getBeatmapUserScores(
            identity: ExternalIdentity,
            beatmapId: number,
            userId: number,
            options: BeatmapScoreQuery,
            preferences: ScorePreferences,
        ): Promise<Array<Score>> {
            const provider = registry.get(identity.provider);
            return provider.getBeatmapUserScores(beatmapId, userId, options, preferences);
        },
    };
}

export const scoreQueryService = createScoreQueryService();
