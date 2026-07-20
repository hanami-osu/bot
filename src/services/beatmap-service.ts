import crypto from "crypto";
import { getEntry, insertData } from "@utils/database";
import { Tables } from "@type/database";

export function isPlausibleBeatmap(contents: string): boolean {
    const trimmed = contents.trim();
    return (
        trimmed.startsWith("osu file format v") &&
        trimmed.includes("[HitObjects]") &&
        trimmed.includes("[Metadata]") &&
        !/^<!doctype html/i.test(trimmed) &&
        !/^<html/i.test(trimmed)
    );
}

export function matchesChecksum(contents: string, checksum?: string): boolean {
    return !checksum || crypto.createHash("md5").update(contents).digest("hex") === checksum;
}

export function createBeatmapService({
    fetch: fetchImpl,
    getCached = async (id: string | number) => (await getEntry(Tables.MAP, id))?.data,
    persist = async (id: string | number, contents: string) =>
        await insertData({ table: Tables.MAP, id, data: [{ key: "data", value: contents }] }),
}: {
    fetch?: (input: URL | Request | string, init?: RequestInit) => Promise<Response>;
    getCached?: (id: string | number) => Promise<string | undefined>;
    persist?: (id: string | number, contents: string) => Promise<unknown>;
} = {}) {
    async function downloadBeatmap(id: string | number, timeoutMs = 6000): Promise<{ id: string | number; contents: string }> {
        const url = `https://osu.ppy.sh/osu/${id}`;
        const signal = AbortSignal.timeout(timeoutMs);
        let response: Response;
        try {
            response = await (fetchImpl ?? globalThis.fetch)(url, { signal });
        } catch (error) {
            if (signal.aborted) throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`, { cause: error });
            throw error;
        }
        if (!response.ok) throw new Error(`Beatmap download failed with HTTP ${response.status}`);
        const contents = await response.text();
        if (!isPlausibleBeatmap(contents)) throw new Error("Beatmap download returned invalid .osu content");
        await persist(id, contents);
        return { id, contents };
    }

    async function getBeatmapContents(id: string | number, checksum?: string): Promise<string> {
        const cached = await getCached(id);
        if (cached && matchesChecksum(cached, checksum)) return cached;
        return (await downloadBeatmap(id)).contents;
    }

    return { downloadBeatmap, getBeatmapContents };
}

export const beatmapService = createBeatmapService();
export const downloadBeatmap = beatmapService.downloadBeatmap;
