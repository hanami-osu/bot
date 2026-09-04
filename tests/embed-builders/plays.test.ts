import { describe, expect, test } from "bun:test";
import { Mode } from "../../src/types/osu";
import type { PlaysBuilderOptions } from "../../src/types/builders";
import type { ProfileInfo, ScoresInfo } from "../../src/types/osu";
import { EMBED_COLORS } from "../../src/embed-builders/common";

const { playBuilder } = await import("../../src/embed-builders/plays");

const profile = {
    username: "yorunoken",
    pp: "10,021.3",
    globalRank: "8,083",
    countryCode: "TR",
    countryRank: "61",
    userUrl: "https://osu.ppy.sh/users/1",
    avatarUrl: "https://a.ppy.sh/1",
    flagUrl: "https://osu.ppy.sh/images/flags/TR.png",
} as ProfileInfo;

function score(index: number, title = `Song ${index}`): ScoresInfo {
    return {
        position: index,
        songNameFormatted: `Artist - ${title}`,
        songArtist: "Artist",
        songName: title,
        retries: 2,
        percentagePassed: null,
        difficultyName: "Expert",
        score: "1,000,000",
        accuracy: "99.00",
        mapLink: `https://osu.ppy.sh/beatmaps/${index}`,
        coverLink: `https://assets.ppy.sh/beatmaps/${index}/covers/cover.jpg`,
        listLink: `https://assets.ppy.sh/beatmaps/${index}/covers/list.jpg`,
        thumbLink: `https://b.ppy.sh/thumb/${index}l.jpg`,
        grade: "A",
        hitValues: "500/0/0",
        fcHitValues: "",
        fcAccuracy: undefined,
        isFc: true,
        mapAuthor: "mapper",
        mapStatus: "Ranked",
        mods: ["HR"],
        drainLength: "2:00",
        stars: "8.00★",
        rulesetEmote: "<:osu:1075928454484205588>",
        pp: 500,
        ppFormatted: "500.00pp",
        playSubmitted: "1 day ago",
        ifFcHanami: null,
        ifFcBathbot: null,
        ifFcOwo: null,
        comboValues: "1,000/1,000x",
        performance: null,
        user: undefined,
        userId: undefined,
    };
}

function builderOptions(options: Partial<PlaysBuilderOptions>): PlaysBuilderOptions {
    return {
        profile,
        mode: Mode.OSU,
        authorDb: null,
        plays: [],
        totalPlays: 0,
        ...options,
    };
}

describe("plays embed builder", () => {
    test("uses total fetched plays when calculating page count", async () => {
        const embeds = await playBuilder(
            builderOptions({
                isMultiple: true,
                page: 0,
                plays: [score(1), score(2), score(3), score(4), score(5)],
                totalPlays: 200,
            }),
        );

        expect(embeds[0]?.footer?.text).toBe("Page 1 of 40");
        expect(embeds[0]?.description).toContain("#1");
        expect(embeds[0]?.description).toContain("#5");
    });

    test("returns a no-match embed when the service provides no formatted plays", async () => {
        const embeds = await playBuilder(
            builderOptions({
                isMultiple: true,
                page: 0,
                plays: [],
                totalPlays: 0,
            }),
        );

        expect(embeds[0]?.title).toBe("Nothing to show");
        expect(embeds[0]?.color).toBe(EMBED_COLORS.brand);
        expect(embeds[0]?.description).toBe("No plays matched those filters for `yorunoken` in `osu`.");
    });

    test("renders single-play position against the filtered total", async () => {
        const embeds = await playBuilder(
            builderOptions({
                index: 1,
                plays: [score(2, "Yami no Uta")],
                totalPlays: 3,
            }),
        );

        expect(embeds[0]?.title).toBe("Artist - Yami no Uta");
        expect(embeds[0]?.footer?.text).toContain("• Play 2 of 3");
        expect(embeds[0]?.footer?.text).toContain("• Try 2");
    });

    test("returns an out-of-range embed without formatted play data", async () => {
        const embeds = await playBuilder(
            builderOptions({
                index: 3,
                plays: [],
                totalPlays: 3,
            }),
        );

        expect(embeds[0]?.title).toBe("Check your input");
        expect(embeds[0]?.color).toBe(EMBED_COLORS.error);
        expect(embeds[0]?.description).toBe("That play index is out of range for `yorunoken`.");
    });
});
