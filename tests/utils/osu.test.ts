import { describe, expect, mock, test } from "bun:test";
import { ScoreData } from "../../src/types/database";
import { shouldUseLazerPerformance } from "../../src/utils/score-preference";

const insertDataMock = mock(() => Promise.resolve());

const { downloadBeatmap } = await import("../../src/utils/osu");
const validBeatmap = "osu file format v14\n[Metadata]\nTitle:Test\n[HitObjects]\n";

function createPlay(legacyScoreId: number | null): Parameters<typeof shouldUseLazerPerformance>[0] {
    return { legacy_score_id: legacyScoreId } as Parameters<typeof shouldUseLazerPerformance>[0];
}

describe("osu utilities", () => {
    mock.module("@utils/database", () => ({
        bulkInsertData: mock(() => Promise.resolve()),
        getEntry: mock(() => Promise.resolve(null)),
        insertData: insertDataMock,
    }));
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

    test("propagates database insertion failures through its returned promise", async () => {
        const originalFetch = globalThis.fetch;
        const databaseFailure = new Error("database unavailable");
        globalThis.fetch = mock(() => Promise.resolve(new Response(validBeatmap))) as unknown as typeof fetch;
        insertDataMock.mockClear();
        insertDataMock.mockImplementationOnce(() => Promise.reject(databaseFailure));

        try {
            await expect(downloadBeatmap(321)).rejects.toThrow(databaseFailure);
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
