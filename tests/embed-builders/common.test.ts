import { describe, expect, test } from "bun:test";
import { simpleErrorEmbed, simpleInfoEmbed, simpleSuccessEmbed, userNotFoundEmbed } from "../../src/embed-builders/common";

describe("common embed builders", () => {
    test("builds the shared user not found embed", () => {
        expect(userNotFoundEmbed("mrekk")).toMatchObject({
            title: "Uh oh! :x:",
            description: "It seems like the user **`mrekk`** doesn't exist! :(",
        });
    });

    test("builds simple status embeds", () => {
        expect(simpleErrorEmbed("Nope")).toMatchObject({ title: "Uh oh! :x:", description: "Nope" });
        expect(simpleInfoEmbed("Look here", "Info")).toMatchObject({ title: "Info", description: "Look here" });
        expect(simpleSuccessEmbed("Done", "Success")).toMatchObject({ title: "Success", description: "Done" });
    });
});
