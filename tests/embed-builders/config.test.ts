import { describe, expect, test } from "bun:test";
import { configListEmbed, configUpdatedEmbed } from "../../src/embed-builders/config";
import { EmbedScoreType } from "../../src/types/database";

describe("config embed builder", () => {
    test("formats updated config changes", () => {
        expect(configUpdatedEmbed("tester", [{ type: "mode", data: "mania" }])).toMatchObject({
            title: "Successfully changed config for tester",
            description: "Updated settings:\nmode: mania\n",
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
        expect(embed.fields).toContainEqual({ name: "score_embeds", value: "Maximized" });
        expect(embed.fields).toContainEqual({ name: "mode", value: "osu" });
        expect(embed.fields).toContainEqual({ name: "score_data", value: "Stable" });
    });
});
