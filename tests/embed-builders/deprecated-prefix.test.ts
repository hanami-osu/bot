import { describe, expect, test } from "bun:test";
import { deprecatedEmbed } from "../../src/embed-builders/deprecated-prefix";
import { EMBED_COLORS } from "../../src/embed-builders/common";

describe("deprecated prefix embed", () => {
    test("uses the shared warning style", () => {
        expect(deprecatedEmbed("config")[0]).toMatchObject({
            title: "Prefix command retired",
            description: "This prefix command has been retired. Use /config instead.",
            color: EMBED_COLORS.warning,
        });
    });
});
