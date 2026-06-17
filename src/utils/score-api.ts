import { v2 } from "osu-api-extended";
import { type User } from "@type/database";
import type { Score, PlayType, Mode } from "@type/osu";

// Gets user scores using V2 unified format
export async function getUserScores(userId: number, type: PlayType, options: { query: { mode: Mode; limit: number; include_fails?: boolean } }, _authorDb: User | null): Promise<Array<Score>> {
    const apiType = type === "best" ? "user_best" : type === "recent" ? "user_recent" : "user_firsts";

    const scores = await v2.scores.list({
        type: apiType,
        user_id: userId,
        mode: options.query.mode,
        limit: options.query.limit,
        include_fails: options.query.include_fails,
    });

    if ("error" in scores || !Array.isArray(scores)) {
        throw new Error(scores.error?.message ?? "Failed to fetch user scores");
    }

    return (scores as Array<Score>).map((score, index) => ({ ...score, position: index + 1 }));
}

// Gets beatmap user scores using V2 unified format
export async function getBeatmapUserScores(beatmapId: number, userId: number, options: { query: { mode: Mode } }, _authorDb: User | null): Promise<Array<Score>> {
    const scores = await v2.scores.list({
        type: "user_beatmap_all",
        beatmap_id: beatmapId,
        user_id: userId,
        mode: options.query.mode,
    });

    if ("error" in scores || !Array.isArray(scores)) {
        throw new Error(scores.error?.message ?? "Failed to fetch beatmap user scores");
    }

    return (scores as Array<Score>).map((score, index) => ({ ...score, position: index + 1 }));
}
