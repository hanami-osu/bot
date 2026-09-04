import { describe, expect, test } from "bun:test";
import type { Embed } from "lilybird";
import {
    applyDefaultEmbedColor,
    beatmapNotFoundEmbed,
    EMBED_COLORS,
    missingBeatmapEmbed,
    simpleErrorEmbed,
    simpleInfoEmbed,
    simpleSuccessEmbed,
    simpleWarningEmbed,
    userNotFoundEmbed,
} from "../../src/embed-builders/common";

describe("common embed builders", () => {
    test("builds the shared user not found embed", () => {
        expect(userNotFoundEmbed("mrekk")).toMatchObject({
            title: "Nothing found",
            description: "I couldn't find an osu! user matching **`mrekk`**.",
            color: EMBED_COLORS.error,
        });
    });

    test("explains when no beatmap could be inferred", () => {
        expect(missingBeatmapEmbed()).toMatchObject({
            title: "Nothing found",
            description: "I couldn't find a beatmap in your command or recent channel messages.",
            color: EMBED_COLORS.error,
        });
    });

    test("builds the shared beatmap not found embed", () => {
        expect(beatmapNotFoundEmbed()).toMatchObject({
            title: "Nothing found",
            description: "I couldn't find that beatmap.",
            color: EMBED_COLORS.error,
        });
    });

    test("styles error responses consistently", () => {
        expect(simpleErrorEmbed("Nope")).toMatchObject({
            title: "Something went wrong",
            description: "Nope",
            color: EMBED_COLORS.error,
        });
    });

    test("styles informational responses consistently", () => {
        expect(simpleInfoEmbed("Look here", "Info")).toMatchObject({
            title: "Info",
            description: "Look here",
            color: EMBED_COLORS.brand,
        });
    });

    test("styles successful responses consistently", () => {
        expect(simpleSuccessEmbed("Done")).toMatchObject({
            title: "All set!",
            description: "Done",
            color: EMBED_COLORS.success,
        });
    });

    test("styles warning responses consistently", () => {
        expect(simpleWarningEmbed("Careful")).toMatchObject({
            title: "Heads up!",
            description: "Careful",
            color: EMBED_COLORS.warning,
        });
    });

    test("adds the brand color without replacing explicit status colors", () => {
        const reply = applyDefaultEmbedColor({
            embeds: [{ title: "Result" }, { title: "Failure", color: EMBED_COLORS.error }] as Array<Embed.Structure>,
        });

        expect(reply.embeds).toEqual([
            { title: "Result", color: EMBED_COLORS.brand },
            { title: "Failure", color: EMBED_COLORS.error },
        ]);
    });
});
