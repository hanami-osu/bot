import { afterEach, describe, expect, test } from "bun:test";
import { cooldownsCache, getCooldownExpiry } from "../../src/state/cooldowns";

afterEach(() => {
    cooldownsCache.clear();
});

describe("cooldowns", () => {
    test("drops expired entries when they are read", () => {
        cooldownsCache.set("ping:user", Date.now() - 1);

        expect(getCooldownExpiry("ping", "user")).toBeUndefined();
        expect(cooldownsCache.has("ping:user")).toBe(false);
    });
});
