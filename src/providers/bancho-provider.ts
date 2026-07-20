import { v2 } from "osu-api-extended";
import { getScoreFetchAddons } from "@utils/score-preference";
import type { Mode, PlayType, Score, UserExtended } from "@type/osu";
import type { BeatmapScoreQuery, ScorePreferences, ScoreProvider, UserScoreQuery } from "./score-provider";

export { USER_SCORE_FETCH_LIMIT } from "./score-provider";
const USER_SCORE_API_PAGE_LIMIT = 100;

export function createBanchoProvider(): ScoreProvider {
    return {
        id: "bancho",
        async getUser(identity: string | number, mode: Mode): Promise<UserExtended | null> {
            const result = await v2.users.details({ user: identity, mode });
            return "error" in result ? null : (result as UserExtended);
        },
        async getUserScores(
            userId: number,
            type: PlayType,
            options: UserScoreQuery,
            preferences: ScorePreferences,
        ): Promise<Array<Score>> {
            const apiType = type === "best" ? "user_best" : type === "recent" ? "user_recent" : "user_firsts";
            const requestedLimit = options.query.limit;
            const scores: Array<Score> = [];

            while (scores.length < requestedLimit) {
                const pageLimit = Math.min(requestedLimit - scores.length, USER_SCORE_API_PAGE_LIMIT);
                const offset = scores.length;
                const page = await v2.scores.list(
                    {
                        type: apiType,
                        user_id: userId,
                        mode: options.query.mode,
                        limit: pageLimit,
                        offset: offset === 0 ? undefined : offset,
                        include_fails: options.query.include_fails,
                    },
                    getScoreFetchAddons(preferences),
                );
                if ("error" in page || !Array.isArray(page)) {
                    throw new Error(page.error?.message ?? "Failed to fetch user scores");
                }
                const pageScores = page as Array<Score>;
                scores.push(...pageScores);
                if (pageScores.length < pageLimit) break;
            }

            return scores.slice(0, requestedLimit).map((score, index) => ({ ...score, position: index + 1 }));
        },
        async getBeatmapUserScores(
            beatmapId: number,
            userId: number,
            options: BeatmapScoreQuery,
            preferences: ScorePreferences,
        ): Promise<Array<Score>> {
            const scores = await v2.scores.list(
                { type: "user_beatmap_all", beatmap_id: beatmapId, user_id: userId, mode: options.query.mode },
                getScoreFetchAddons(preferences),
            );
            if ("error" in scores || !Array.isArray(scores)) {
                throw new Error(scores.error?.message ?? "Failed to fetch beatmap user scores");
            }
            return (scores as Array<Score>).map((score, index) => ({ ...score, position: index + 1 }));
        },
    };
}

export const banchoProvider = createBanchoProvider();
