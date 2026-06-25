import { IDefaultParams as AddonParams, v2 } from "osu-api-extended";
import { ScoreData, type User } from "@type/database";
import type { Score, PlayType, Mode } from "@type/osu";

export const USER_SCORE_FETCH_LIMIT = 200;
const USER_SCORE_API_PAGE_LIMIT = 100;

function getScoreFetchAddons(authorDb: User | null): AddonParams | undefined {
    if (typeof authorDb?.score_data !== "number") return undefined;

    return {
        legacy_only: authorDb.score_data === ScoreData.Stable,
    };
}

interface UserScoresOptions {
    query: {
        mode: Mode;
        limit: number;
        include_fails?: boolean;
    };
}

// Gets user scores using V2 unified format
export async function getUserScores(userId: number, type: PlayType, options: UserScoresOptions, authorDb: User | null): Promise<Array<Score>> {
    const apiType = type === "best" ? "user_best" : type === "recent" ? "user_recent" : "user_firsts";
    const requestedLimit = options.query.limit;
    const scores: Array<Score> = [];

    while (scores.length < requestedLimit) {
        const remainingLimit = requestedLimit - scores.length;
        const pageLimit = Math.min(remainingLimit, USER_SCORE_API_PAGE_LIMIT);
        const pageOffset = scores.length;
        const page = await v2.scores.list(
            {
                type: apiType,
                user_id: userId,
                mode: options.query.mode,
                limit: pageLimit,
                offset: pageOffset === 0 ? undefined : pageOffset,
                include_fails: options.query.include_fails,
            },
            getScoreFetchAddons(authorDb),
        );

        if ("error" in page || !Array.isArray(page)) {
            throw new Error(page.error?.message ?? "Failed to fetch user scores");
        }

        const pageScores = page as Array<Score>;
        scores.push(...pageScores);
        if (pageScores.length < pageLimit) break;
    }

    return scores.slice(0, requestedLimit).map((score, index) => ({ ...score, position: index + 1 }));
}

// Gets beatmap user scores using V2 unified format
export async function getBeatmapUserScores(beatmapId: number, userId: number, options: { query: { mode: Mode } }, authorDb: User | null): Promise<Array<Score>> {
    const scores = await v2.scores.list(
        {
            type: "user_beatmap_all",
            beatmap_id: beatmapId,
            user_id: userId,
            mode: options.query.mode,
        },
        getScoreFetchAddons(authorDb),
    );

    if ("error" in scores || !Array.isArray(scores)) {
        throw new Error(scores.error?.message ?? "Failed to fetch beatmap user scores");
    }

    return (scores as Array<Score>).map((score, index) => ({ ...score, position: index + 1 }));
}
