import { describe, expect, mock, test } from "bun:test";
import { ScoreData } from "../../src/types/database";
import { shouldUseLazerPerformance } from "../../src/utils/score-preference";

const insertDataMock = mock(() => Promise.resolve());
const bulkInsertDataMock = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    bulkInsertData: bulkInsertDataMock,
    getEntry: mock(() => Promise.resolve(null)),
    insertData: insertDataMock,
}));

const { downloadBeatmap, getBeatmapTopScores, saveScoreDatas } = await import("../../src/utils/osu");
const validBeatmap = "osu file format v14\n[Metadata]\nTitle:Test\n[HitObjects]\n";

function createPlay(legacyScoreId: number | null): Parameters<typeof shouldUseLazerPerformance>[0] {
    return { legacy_score_id: legacyScoreId } as Parameters<typeof shouldUseLazerPerformance>[0];
}

describe("osu utilities", () => {
    describe("shouldUseLazerPerformance", () => {
        test("stable config forces classic performance rules", () => {
            expect(shouldUseLazerPerformance(createPlay(null), ScoreData.Stable)).toBe(false);
        });

        test("lazer config forces lazer performance rules", () => {
            expect(shouldUseLazerPerformance(createPlay(123), ScoreData.Lazer)).toBe(true);
        });

        test("falls back to classic rules for legacy scores without config", () => {
            expect(shouldUseLazerPerformance(createPlay(123), null)).toBe(false);
        });

        test("falls back to lazer rules for non-legacy scores without config", () => {
            expect(shouldUseLazerPerformance(createPlay(null), null)).toBe(true);
        });
    });
});

describe("downloadBeatmap", () => {
    test("persists and returns a valid beatmap response", async () => {
        const originalFetch = globalThis.fetch;
        const fetchMock = mock(() => Promise.resolve(new Response(validBeatmap)));
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        insertDataMock.mockClear();

        try {
            await expect(downloadBeatmap(123)).resolves.toEqual({ id: 123, contents: validBeatmap });
            expect(fetchMock).toHaveBeenCalledWith("https://osu.ppy.sh/osu/123", { signal: expect.any(AbortSignal) });
            expect(insertDataMock).toHaveBeenCalledWith({ table: "maps", id: 123, data: [{ key: "data", value: validBeatmap }] });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects unsuccessful responses with their HTTP status", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock(() => Promise.resolve(new Response("not found", { status: 404 }))) as unknown as typeof fetch;

        try {
            await expect(downloadBeatmap(456)).rejects.toThrow("HTTP 404");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects HTML or malformed beatmap content", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock(() => Promise.resolve(new Response("<!doctype html><html>not a beatmap</html>"))) as unknown as typeof fetch;

        try {
            await expect(downloadBeatmap(789)).rejects.toThrow("invalid .osu content");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("returns the beatmap when caching it fails", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock(() => Promise.resolve(new Response(validBeatmap))) as unknown as typeof fetch;
        insertDataMock.mockClear();
        insertDataMock.mockImplementationOnce(() => Promise.reject(new Error("Unique constraint failed (P2002)")));

        try {
            await expect(downloadBeatmap(321)).resolves.toEqual({ id: 321, contents: validBeatmap });
            expect(insertDataMock).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects timed-out requests with the request URL and timeout duration", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock(
            (_url: URL | Request | string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    const signal = init?.signal;
                    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
                }),
        ) as unknown as typeof fetch;

        try {
            await expect(downloadBeatmap(654, 1)).rejects.toThrow("https://osu.ppy.sh/osu/654 timed out after 1ms");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

describe("saveScoreDatas", () => {
    test("does not fail when the score cache write fails", async () => {
        bulkInsertDataMock.mockImplementationOnce(() => Promise.reject(new Error("Transaction already closed (P2028)")));
        const score = {
            id: 1,
            user_id: 2,
            passed: true,
            mods: [],
            score: 1000,
            accuracy: 1,
            max_combo: 10,
            rank: "S",
            statistics: { count_300: 10 },
            beatmap: { id: 3, status: "ranked" },
            created_at: "2026-01-01T00:00:00Z",
        };

        await expect(saveScoreDatas([score] as never, "osu" as never)).resolves.toBeUndefined();
        expect(bulkInsertDataMock).toHaveBeenCalledTimes(1);
    });
});

describe("getBeatmapTopScores", () => {
    test("aborts leaderboard requests that exceed the timeout", async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = mock(
            (_url: URL | Request | string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    const signal = init?.signal;
                    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
                }),
        ) as unknown as typeof fetch;

        try {
            await expect(
                getBeatmapTopScores({ beatmapId: 72727, isGlobal: true, mode: "osu", mods: undefined, authorDb: null, timeoutMs: 1 }),
            ).rejects.toThrow();
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
