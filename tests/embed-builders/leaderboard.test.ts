import { describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../src/embed-builders/common";

const getEntry = mock(() => Promise.resolve<{ data: string } | null>({ data: "osu file format v14\n[HitObjects]\n" }));
const downloadBeatmap = mock(() => Promise.resolve({ contents: "" }));

mock.module("@utils/database", () => ({ getEntry }));

mock.module("@utils/osu", () => ({ downloadBeatmap }));

mock.module("@utils/formatter", () => ({
    getFormattedScore: mock(() =>
        Promise.resolve({
            position: 1,
            grade: "A",
            user: "peppy",
            userId: 2,
            stars: "5.00★",
            mods: ["NM"],
            ppFormatted: "100.00pp",
            accuracy: "99.00",
            score: "1,000,000",
            hitValues: "300/0/0/0",
            comboValues: "100x",
            playSubmitted: "today",
        }),
    ),
}));

const { leaderboardBuilder } = await import("../../src/embed-builders/leaderboard");

describe("leaderboard embed builder", () => {
    test("uses an informational empty state when a beatmap has no scores", async () => {
        const embeds = await leaderboardBuilder({ scores: [] } as never);

        expect(embeds[0]).toMatchObject({
            title: "Nothing to show",
            color: EMBED_COLORS.brand,
            description: "No scores here yet. Maybe you'll be first :3",
        });
    });

    test("keeps pagination position out of the leaderboard footer", async () => {
        const embeds = await leaderboardBuilder({
            scores: [{ id: 1 }],
            beatmap: {
                id: 72727,
                mode: "osu",
                status: "ranked",
                version: "Expert",
                beatmapset: { id: 1234, artist: "Artist", title: "Song", creator: "Mapper" },
            },
            authorDb: null,
            page: 0,
        } as never);

        expect(embeds[0]?.footer?.text).toBe("Ranked beatmapset by Mapper");
    });

    test("shows a friendly error when the beatmap can't be downloaded", async () => {
        getEntry.mockResolvedValueOnce(null);
        downloadBeatmap.mockRejectedValueOnce(new Error("Beatmap download failed with HTTP 500"));

        const embeds = await leaderboardBuilder({ scores: [{ id: 1 }], beatmap: { id: 72727, mode: "osu" }, authorDb: null } as never);

        expect(embeds[0]).toMatchObject({
            color: EMBED_COLORS.error,
            description: "I couldn't calculate performance for that beatmap. Please try again in a moment.",
        });
    });
});
