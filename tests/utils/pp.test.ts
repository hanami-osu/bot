import { describe, expect, test } from "bun:test";

const { calculatePpRequirement, parsePpRequirementPrefixArgs, validatePpRequirementInput } = await import(
    "../../src/utils/pp-requirement"
);

describe("pp utilities", () => {
    test("parses target, play pp, count, and remaining user args from prefix input", () => {
        const playResult = parsePpRequirementPrefixArgs(["10000", "500pp", "mrekk"]);
        expect(playResult.input).toEqual({ targetTotalPp: 10000, playPp: 500, playCount: undefined });
        expect(playResult.remainingArgs).toEqual(["mrekk"]);

        const countResult = parsePpRequirementPrefixArgs(["target=10000", "plays=5", "mrekk", "mode=taiko"]);
        expect(countResult.input).toEqual({ targetTotalPp: 10000, playPp: undefined, playCount: 5 });
        expect(countResult.remainingArgs).toEqual(["mrekk", "mode=taiko"]);
    });

    test("calculates the repeated play pp needed for a target", () => {
        const result = calculatePpRequirement(1000, [500, 400], { targetTotalPp: 1400, playCount: 1 });

        expect(result.kind).toBe("required_play_pp");
        if (result.kind !== "required_play_pp") throw new Error("Expected required play pp result");
        expect(result.requiredPlayPp).toBeGreaterThan(440);
        expect(result.projection.projectedTotalPp).toBeGreaterThanOrEqual(1400);
    });

    test("calculates how many plays of a pp value are needed", () => {
        const result = calculatePpRequirement(1000, [500, 400], { targetTotalPp: 1500, playPp: 450 });

        expect(result.kind).toBe("required_play_count");
        if (result.kind !== "required_play_count") throw new Error("Expected required play count result");
        expect(result.playCount).toBeGreaterThan(1);
        expect(result.projection.projectedTotalPp).toBeGreaterThanOrEqual(1500);
    });

    test("returns already reached when the target is below current pp", () => {
        expect(calculatePpRequirement(1000, [500, 400], { targetTotalPp: 999 })).toEqual({
            kind: "already_reached",
            targetTotalPp: 999,
            currentTotalPp: 1000,
        });
    });

    test("rejects specifying both play pp and play count", () => {
        expect(() => validatePpRequirementInput({ targetTotalPp: 1400, playPp: 450, playCount: 2 })).toThrow(
            "Provide either a play pp value or a play count, not both.",
        );
    });
});
