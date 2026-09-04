import { describe, expect, test } from "bun:test";
import { prefixListEmbed } from "../../src/embed-builders/prefix";
import { EMBED_COLORS } from "../../src/embed-builders/common";

describe("prefix embed builder", () => {
    test("formats the current prefix list", () => {
        expect(prefixListEmbed(["!", "?"])).toMatchObject({
            title: "Currently defined prefixes",
            description: "**`!`**, `?`**",
            color: EMBED_COLORS.brand,
        });
    });
});
