import { describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../src/embed-builders/common";

mock.module("@utils/database", () => ({
    getEntry: mock(() => Promise.resolve({ data: "osu file format v14\n[HitObjects]\n" })),
}));

mock.module("@utils/osu", () => ({
    downloadBeatmap: mock(() => Promise.resolve({ contents: "osu file format v14\n[HitObjects]\n" })),
}));

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

    test("separates leaderboard footer details consistently", async () => {
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

        expect(embeds[0]?.footer?.text).toContain("• Page 1 of 1");
    });
});
