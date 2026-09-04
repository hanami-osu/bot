import { describe, expect, mock, test } from "bun:test";
import { EmbedBuilderType } from "../../src/types/builders";
import { Mode } from "../../src/types/osu";
import type { CompareBuilderOptions } from "../../src/types/builders";
import type { Score } from "../../src/types/osu";
import { EMBED_COLORS } from "../../src/embed-builders/common";

mock.module("@utils/database", () => ({
    getEntry: mock(() => Promise.resolve({ data: "osu file format v14\n[Metadata]\nTitle:Test\n[HitObjects]\n" })),
}));

mock.module("@utils/osu", () => ({
    downloadBeatmap: mock(() => Promise.resolve({ contents: "osu file format v14\n[Metadata]\nTitle:Test\n[HitObjects]\n" })),
    saveScoreDatas: mock(() => Promise.resolve()),
}));

mock.module("@utils/formatter", () => ({
    getFormattedProfile: mock(() => ({
        username: "peppy",
        pp: "10,000",
        globalRank: "1",
        countryCode: "JP",
        countryRank: "1",
        userUrl: "https://osu.ppy.sh/users/2",
        flagUrl: "https://osu.ppy.sh/images/flags/JP.png",
    })),
    getFormattedScore: mock(({ scores, index }: { scores: Array<Score>; index: number }) => {
        const score = scores[index];
        const pp = score.id === 1 ? 100 : 900;
        return Promise.resolve({
            grade: "A",
            stars: "5.00★",
            pp,
            ppFormatted: `${pp}.00pp`,
            accuracy: "99.00",
            mods: ["NM"],
            score: score.score?.toLocaleString() ?? "0",
            hitValues: "300/0/0/0",
            comboValues: "100x",
            playSubmitted: "today",
        });
    }),
}));

const { compareBuilder } = await import("../../src/embed-builders/compare");

function score(id: number, rawPp: number): Score {
    return {
        id,
        user_id: 1,
        accuracy: 0.99,
        max_combo: 100,
        passed: true,
        pp: rawPp,
        rank: "A",
        score: 1000000 + id,
        statistics: {},
        beatmap: { id: 72727 } as never,
        beatmapset: { id: 1234, title: "Song", artist: "Artist", creator: "Mapper", status: "ranked" },
        mods: [],
    };
}

function options(plays: Array<Score>): CompareBuilderOptions {
    return {
        type: EmbedBuilderType.COMPARE,
        initiatorId: "1",
        beatmap: {
            id: 72727,
            status: "ranked",
            version: "Expert",
            beatmapset: { id: 1234, title: "Song", artist: "Artist", creator: "Mapper", status: "ranked" },
        } as never,
        plays,
        user: { id: 2, username: "peppy" } as never,
        mode: Mode.OSU,
        authorDb: null,
        page: 0,
    };
}

describe("compare embed builder", () => {
    test("sorts displayed plays by formatted pp instead of raw API pp", async () => {
        const embeds = await compareBuilder(options([score(1, 1000), score(2, 1)]));
        const description = embeds[0]?.description ?? "";

        expect(description.indexOf("900.00pp")).toBeLessThan(description.indexOf("100.00pp"));
        expect(embeds[0]?.footer?.text).toBe("Ranked beatmapset by Mapper");
    });

    test("uses an informational empty state when no scores match", async () => {
        const embeds = await compareBuilder(options([]));

        expect(embeds[0]).toMatchObject({
            title: "Nothing to show",
            color: EMBED_COLORS.brand,
            description: "`peppy` has no matching scores on this beatmap.",
        });
    });
});
