export interface BeatMapSetURL {
    url: string;
    setId: string;
    gameMode: string | null;
    difficultyId: string | null;
}

export interface BeatMapURL {
    url: string;
    id: string;
}

function isDecimalInteger(value: string): boolean {
    return /^\d+$/.test(value);
}

export function parseBeatmapUrl(url: string): BeatMapSetURL | BeatMapURL | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "osu.ppy.sh") return null;
    const path = parsed.pathname.replace(/\/+$/, "");
    const legacyBeatmap = /^\/b\/(\d+)$/.exec(path);
    if (legacyBeatmap) return { url, id: legacyBeatmap[1] };
    const beatmap = /^\/beatmaps\/(\d+)$/.exec(path);
    if (beatmap) return { url, id: beatmap[1] };
    const beatmapset = /^\/beatmapsets\/(\d+)$/.exec(path);
    if (!beatmapset) return null;
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "";
    if (!hash) return { url, setId: beatmapset[1], gameMode: null, difficultyId: null };
    const [gameMode, difficultyId] = hash.split("/");
    if (!gameMode || !difficultyId || !isDecimalInteger(difficultyId)) return null;
    return { url, setId: beatmapset[1], gameMode, difficultyId };
}

export function getBeatmapId(url: BeatMapSetURL | BeatMapURL | null): string | null {
    if (!url) return null;
    return "id" in url ? url.id : url.difficultyId;
}
