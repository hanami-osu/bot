import { describe, expect, test } from "bun:test";
import { prefixListEmbed } from "../../src/embed-builders/prefix";

describe("prefix embed builder", () => {
    test("formats the current prefix list", () => {
        expect(prefixListEmbed(["!", "?"])).toMatchObject({
            title: "Currently defined prefixes",
            description: "**`!`**, `?`**",
        });
    });
});
