import { describe, expect, mock, test } from "bun:test";
import { Mode } from "../../src/types/osu";

const { calculateWhatIfProjection, calculateWeightedPp, clearWhatIfRankCache, estimateGlobalRankFromPp, extractWhatIfPlayPps, parseWhatIfPlayPps } = await import("../../src/utils/whatif");

describe("whatif utilities", () => {
    test("parses pp values from slash input", () => {
        expect(parseWhatIfPlayPps("500 480.5pp, 450")).toEqual([500, 480.5, 450]);
    });

    test("extracts pp values from prefix args and keeps user args", () => {
        const result = extractWhatIfPlayPps(["500pp", "480,450", "mrekk", "mode=taiko"]);

        expect(result.playPps).toEqual([500, 480, 450]);
        expect(result.remainingArgs).toEqual(["mrekk", "mode=taiko"]);
    });

    test("calculates weighted pp with osu decay", () => {
        expect(calculateWeightedPp([100, 200, 300])).toBeCloseTo(300 + 200 * 0.95 + 100 * 0.95 ** 2);
    });

    test("preserves bonus pp while adding hypothetical plays", () => {
        const projection = calculateWhatIfProjection(1000, [500, 400], [450]);

        expect(projection.currentWeightedPp).toBeCloseTo(500 + 400 * 0.95);
        expect(projection.currentBonusPp).toBeCloseTo(120);
        expect(projection.projectedWeightedPp).toBeCloseTo(500 + 450 * 0.95 + 400 * 0.95 ** 2);
        expect(projection.projectedTotalPp).toBeCloseTo(projection.projectedWeightedPp + 120);
        expect(projection.ppGain).toBeGreaterThan(0);
    });

    test("returns zero gain when hypothetical plays do not enter the weighted top 100", () => {
        const currentPlayPps = Array.from({ length: 100 }, (_value, index) => 500 - index);
        const currentTotalPp = calculateWeightedPp(currentPlayPps);
        const projection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, [1]);

        expect(projection.projectedTotalPp).toBeCloseTo(currentTotalPp);
        expect(projection.ppGain).toBe(0);
    });

    test("estimates rank through osu!daily pp browser and caches the result", async () => {
        const originalApiKey = process.env.OSU_DAILY_API;
        const originalFetch = globalThis.fetch;
        process.env.OSU_DAILY_API = "daily-key";
        clearWhatIfRankCache();

        const fetchMock = mock((input: URL | Request | string) => {
            const url = new URL(String(input));
            expect(url.origin + url.pathname).toBe("https://osudaily.net/api/pp.php");
            expect(url.searchParams.get("k")).toBe("daily-key");
            expect(url.searchParams.get("t")).toBe("pp");
            expect(url.searchParams.get("v")).toBe("1000.000");
            expect(url.searchParams.get("m")).toBe("3");

            return Promise.resolve(new Response(JSON.stringify({ rank: "110524", pp: "999.791" })));
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        try {
            await expect(estimateGlobalRankFromPp(1000, Mode.MANIA)).resolves.toBe(110524);
            await expect(estimateGlobalRankFromPp(1000, Mode.MANIA)).resolves.toBe(110524);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.fetch = originalFetch;
            if (typeof originalApiKey === "undefined") Reflect.deleteProperty(process.env, "OSU_DAILY_API");
            else process.env.OSU_DAILY_API = originalApiKey;
            clearWhatIfRankCache();
        }
    });
});
