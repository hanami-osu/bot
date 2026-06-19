import { describe, expect, test } from "bun:test";
import { ppRequirementEmbed } from "../../src/embed-builders/pp";
import { Mode } from "../../src/types/osu";
import type { PpRequirementResult } from "../../src/utils/pp-requirement";

const user = {
    id: 1,
    username: "mrekk",
    avatar_url: "https://a.ppy.sh/1",
    country_code: "US",
    statistics: {
        pp: 1000,
        global_rank: 10,
    },
} as any;

describe("pp requirement embed builder", () => {
    test("formats a required play pp result", () => {
        const result: PpRequirementResult = {
            kind: "required_play_pp",
            targetTotalPp: 1400,
            playCount: 1,
            requiredPlayPp: 500,
            projection: {
                currentTotalPp: 1000,
                currentWeightedPp: 900,
                currentBonusPp: 100,
                projectedTotalPp: 1400,
                projectedWeightedPp: 1300,
                ppGain: 400,
                playPps: [500],
            },
        };

        const embed = ppRequirementEmbed(user, Mode.OSU, result);

        expect(embed.author?.name).toBe("mrekk: 1,000.00pp (#10)");
        expect(embed.description).toContain("To reach **1,400.00pp**");
        expect(embed.description).toContain("**1** play worth **500.00pp** each");
        expect(embed.fields?.[0]?.value).toBe("`1,400.00pp` (+`400.00pp`)");
        expect(embed.footer?.text).toBe("Assumes new plays are added as equal pp scores.");
    });

    test("formats an already reached result", () => {
        const embed = ppRequirementEmbed(user, Mode.OSU, {
            kind: "already_reached",
            targetTotalPp: 900,
            currentTotalPp: 1000,
        });

        expect(embed.description).toBe("**mrekk** already has **1,000.00pp**, which meets the **900.00pp** target.");
        expect(embed.fields).toBeUndefined();
    });
});
