import { describe, expect, test } from "bun:test";
import { whatIfBuilder } from "../../src/embed-builders/whatif";
import { EmbedBuilderType } from "../../src/types/builders";
import { Mode } from "../../src/types/osu";

describe("whatif embed builder", () => {
    test("formats projected pp and rank details", () => {
        const embeds = whatIfBuilder({
            type: EmbedBuilderType.WHATIF,
            initiatorId: "123",
            mode: Mode.OSU,
            projectedRank: 2,
            user: {
                id: 1,
                username: "mrekk",
                avatar_url: "https://a.ppy.sh/1",
                country_code: "US",
                statistics: {
                    pp: 1000,
                    global_rank: 10,
                    country_rank: 1,
                },
            } as any,
            projection: {
                currentTotalPp: 1000,
                currentWeightedPp: 880,
                currentBonusPp: 120,
                projectedTotalPp: 1408.5,
                projectedWeightedPp: 1288.5,
                ppGain: 408.5,
                playPps: [450],
            },
        });

        expect(embeds[0].author?.name).toContain("mrekk");
        expect(embeds[0].author?.name).toContain("US#1");
        expect(embeds[0].description).toContain("1,408.50pp");
        expect(embeds[0].description).toContain("#2");
        expect(embeds[0].fields?.[0]?.value).toContain("+`408.50pp`");
    });

    test("shows a no-change message when the play does not affect total pp", () => {
        const embeds = whatIfBuilder({
            type: EmbedBuilderType.WHATIF,
            initiatorId: "123",
            mode: Mode.OSU,
            projectedRank: 10,
            user: {
                id: 1,
                username: "mrekk",
                avatar_url: "https://a.ppy.sh/1",
                country_code: "US",
                statistics: {
                    pp: 1000,
                    global_rank: 10,
                    country_rank: 1,
                },
            } as any,
            projection: {
                currentTotalPp: 1000,
                currentWeightedPp: 880,
                currentBonusPp: 120,
                projectedTotalPp: 1000,
                projectedWeightedPp: 880,
                ppGain: 0,
                playPps: [1],
            },
        });

        expect(embeds[0].description).toContain("would not affect");
        expect(embeds[0].author?.name).toContain("US#1");
        expect(embeds[0].fields).toBeUndefined();
        expect(embeds[0].footer).toBeUndefined();
    });
});
