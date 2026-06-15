import { describe, expect, test } from "bun:test";
import { formatCooldown } from "../../src/embed-builders/help";

describe("help embed builder", () => {
    test.each([
        [undefined, "1 second"],
        [1000, "1 second"],
        [1500, "1.5 seconds"],
        [2000, "2 seconds"],
    ] as const)("formats %p cooldown as %p", (cooldown, expected) => {
        expect(formatCooldown(cooldown)).toBe(expected);
    });
});
