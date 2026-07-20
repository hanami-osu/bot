import { getLegacyOnlyQueryValue } from "@utils/score-preference";
import type { User } from "@type/database";
import type { GameMode, LeaderboardScore, LeaderboardScoresRaw } from "@type/osu";

export async function getBeatmapTopScores({
    beatmapId,
    isGlobal,
    mode,
    mods,
    authorDb,
}: {
    beatmapId: number;
    isGlobal: boolean;
    mode: GameMode;
    mods?: Array<string>;
    authorDb: User | null;
}): Promise<Array<LeaderboardScore>> {
    const url = new URL(`https://osu.ppy.sh/beatmaps/${beatmapId}/scores`);
    url.searchParams.set("mode", mode);
    url.searchParams.set("type", isGlobal ? "global" : "country");
    const legacyOnly = getLegacyOnlyQueryValue(authorDb);
    if (typeof legacyOnly !== "undefined") url.searchParams.set("legacy_only", legacyOnly);
    for (const mod of mods ?? []) url.searchParams.append("mods[]", mod.toUpperCase());
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", Cookie: `osu_session=${process.env.OSU_ACCESS_TOKEN}` },
    });
    let data: LeaderboardScoresRaw;
    try {
        data = (await response.json()) as LeaderboardScoresRaw;
    } catch {
        throw new Error("Failed to fetch top scores");
    }
    if (!response.ok || !Array.isArray(data.scores)) throw new Error("Failed to fetch top scores");
    return data.scores.map((score, index) => ({ ...score, position: index }));
}
