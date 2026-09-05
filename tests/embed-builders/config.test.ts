import { describe, expect, test } from "bun:test";
import { configListEmbed, configUpdatedEmbed } from "../../src/embed-builders/config";
import { EmbedScoreType } from "../../src/types/database";
import { EMBED_COLORS } from "../../src/embed-builders/common";

describe("config embed builder", () => {
    test("formats updated config changes", () => {
        expect(configUpdatedEmbed("tester", [{ type: "mode", data: "mania" }])).toMatchObject({
            title: "Updated settings for tester",
            description: "Updated settings:\n**Game mode:** `mania`",
            color: EMBED_COLORS.success,
        });
    });

    test("formats config settings with defaults", () => {
        const embed = configListEmbed("tester", {
            id: "user-1",
            banchoId: null,
            score_embeds: 1,
            embed_type: EmbedScoreType.Hanami,
            mode: null,
            score_data: null,
        });

        expect(embed.title).toBe("Config settings of tester");
        expect(embed.color).toBe(EMBED_COLORS.brand);
        expect(embed.fields).toContainEqual({ name: "Score layout", value: "Maximized" });
        expect(embed.fields).toContainEqual({ name: "Game mode", value: "osu" });
        expect(embed.fields).toContainEqual({ name: "Score data", value: "Stable" });
        expect(embed.fields).toContainEqual({ name: "Embed style", value: "hanami" });
    });
});
