import { describe, expect, test } from "bun:test";
import {
    EMBED_COLORS,
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
});
