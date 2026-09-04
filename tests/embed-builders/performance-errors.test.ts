import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../src/embed-builders/common";

const beatmap = {
    id: 72727,
    beatmapset_id: 1234,
    beatmapset: {
        id: 1234,
        artist: "Artist",
        title: "Song",
        creator: "Mapper",
        status: "ranked",
        user_id: 2,
    },
    mode: "osu",
    mode_int: 0,
    version: "Expert",
    checksum: "checksum",
    bpm: 180,
    total_length: 120,
    max_combo: 500,
    count_circles: 100,
    count_sliders: 100,
    count_spinners: 1,
};

mock.module("osu-api-extended", () => ({
    v2: { beatmaps: { details: mock(() => Promise.resolve(beatmap)) } },
}));

const safeParse = mock(() => Promise.resolve<any>({ success: true, data: beatmap }));

mock.module("@utils/safe-parse", () => ({ safeParse }));

mock.module("@utils/database", () => ({
    getEntry: mock(() => Promise.resolve({ data: "osu file format v14" })),
}));

mock.module("@utils/osu", () => ({
    accuracyCalculator: mock(() => 100),
    downloadBeatmap: mock(() => Promise.resolve({ contents: "osu file format v14" })),
    formatDuration: mock(() => "2:00"),
    getPerformanceResults: mock(() => Promise.resolve(null)),
    gradeCalculator: mock(() => "SS"),
    hitValueCalculator: mock(() => "500/0/0/0"),
}));

const { beatmapBuilder } = await import("../../src/embed-builders/beatmap");
const { simulateBuilder } = await import("../../src/embed-builders/simulate");

describe("performance embed failures", () => {
    beforeEach(() => {
        safeParse.mockReset();
        safeParse.mockResolvedValue({ success: true, data: beatmap });
    });

    test("uses a clear missing-beatmap response for beatmap details", async () => {
        safeParse.mockResolvedValueOnce({ success: false, error: { message: "not found" } });

        const embeds = await beatmapBuilder({ beatmapId: 72727 } as never);

        expect(embeds[0]).toMatchObject({
            title: "Nothing found",
            color: EMBED_COLORS.error,
            description: "I couldn't find that beatmap.",
        });
    });

    test("uses a clear missing-beatmap response for simulations", async () => {
        safeParse.mockResolvedValueOnce({ success: false, error: { message: "not found" } });

        const embeds = await simulateBuilder({ beatmapId: 72727, options: {} } as never);

        expect(embeds[0]).toMatchObject({
            title: "Nothing found",
            color: EMBED_COLORS.error,
            description: "I couldn't find that beatmap.",
        });
    });

    test("hides internal performance details from beatmap responses", async () => {
        const embeds = await beatmapBuilder({ beatmapId: 72727 } as never);

        expect(embeds[0]).toMatchObject({
            title: "Something went wrong",
            color: EMBED_COLORS.error,
            description: "I couldn't calculate performance for that beatmap. Please try again in a moment.",
        });
        expect(embeds[0]?.description).not.toContain("PERFORMANCES IS NULL");
    });

    test("hides internal performance details from simulation responses", async () => {
        const embeds = await simulateBuilder({ beatmapId: 72727, options: {} } as never);

        expect(embeds[0]).toMatchObject({
            title: "Something went wrong",
            color: EMBED_COLORS.error,
            description: "I couldn't calculate performance for that beatmap. Please try again in a moment.",
        });
        expect(embeds[0]?.description).not.toContain("PERFORMANCES IS NULL");
    });
});
