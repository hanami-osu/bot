import { describe, expect, mock, test } from "bun:test";
import { EmbedBuilderType } from "../../src/types/builders";
import { Mode } from "../../src/types/osu";

const saveScoreDatasMock = mock(() => Promise.resolve());

mock.module("@utils/osu", () => ({
    saveScoreDatas: saveScoreDatasMock,
}));

mock.module("@utils/formatter", () => ({
    getFormattedProfile: mock(() => ({
        username: "yorunoken",
        pp: "10,021.3",
        globalRank: "8,083",
        countryCode: "TR",
        countryRank: "61",
        userUrl: "https://osu.ppy.sh/users/1",
        avatarUrl: "https://a.ppy.sh/1",
        flagUrl: "https://osu.ppy.sh/images/flags/TR.png",
    })),
    getFormattedScore: mock(({ index }: { index: number }) =>
        Promise.resolve({
            position: index + 1,
            songName: `Song ${index + 1}`,
            difficultyName: "Expert",
            mapLink: `https://osu.ppy.sh/beatmaps/${index + 1}`,
            mods: ["HR"],
            stars: "8.00★",
            grade: "A",
            ppFormatted: "500.00pp",
            score: "1,000,000",
            accuracy: "99.00",
            hitValues: "500/0/0",
            comboValues: "1,000/1,000x",
            playSubmitted: "1 day ago",
        }),
    ),
}));

const { playBuilder } = await import("../../src/embed-builders/plays");

describe("plays embed builder", () => {
    test("uses all fetched plays when calculating top command page count", async () => {
        const plays = Array.from({ length: 200 }, (_value, index) => ({ id: index + 1 }));

        const embeds = await playBuilder({
            type: EmbedBuilderType.PLAYS,
            initiatorId: "user-1",
            user: { id: 1, username: "yorunoken" },
            mode: Mode.OSU,
            authorDb: null,
            isMultiple: true,
            isPage: true,
            page: 0,
            plays,
        } as never);

        expect(saveScoreDatasMock).toHaveBeenCalledWith(plays, Mode.OSU);
        expect(embeds[0]?.footer?.text).toBe("Page 1 of 40");
        expect(embeds[0]?.description).toContain("#1");
        expect(embeds[0]?.description).toContain("#5");
    });
});
