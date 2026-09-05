import { describe, expect, mock, test } from "bun:test";
import { EmbedType } from "lilybird";
import { EMBED_COLORS } from "../../src/embed-builders/common";
import { CommandContext } from "../../src/utils/command-context";

function createContext(commandName?: string) {
    const interaction = {
        deferReply: mock(() => Promise.resolve()),
        reply: mock(() => Promise.resolve()),
        editReply: mock(() => Promise.resolve()),
    } as any;

    return { ctx: new CommandContext({} as any, interaction, undefined, [], undefined, commandName), interaction };
}

describe("CommandContext", () => {
    test("uses the initial interaction reply before a response is sent", async () => {
        const { ctx, interaction } = createContext();

        await ctx.reply("hello");

        expect(interaction.reply).toHaveBeenCalledWith("hello");
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test("edits the interaction response when reply is called after defer", async () => {
        const { ctx, interaction } = createContext();

        await ctx.defer(true);
        await ctx.reply({ content: "done" });

        expect(interaction.deferReply).toHaveBeenCalledWith(true);
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith({ content: "done" });
    });

    test("adds the brand color to result embeds", async () => {
        const { ctx, interaction } = createContext();

        await ctx.reply({ embeds: [{ title: "Result" }] });

        expect(interaction.reply).toHaveBeenCalledWith({ embeds: [{ title: "Result", color: EMBED_COLORS.brand }] });
    });

    test("leaves help embeds unchanged for the later help redesign", async () => {
        const { ctx, interaction } = createContext("help");

        await ctx.reply({ embeds: [{ title: "Help" }] });

        expect(interaction.reply).toHaveBeenCalledWith({ embeds: [{ title: "Help" }] });
    });

    test("renders validation failures as error embeds after defer", async () => {
        const { ctx, interaction } = createContext();

        await ctx.defer();
        await ctx.respondError("Page must be at least 1.", "Check your input");

        expect(interaction.editReply).toHaveBeenCalledWith({
            embeds: [
                {
                    type: EmbedType.Rich,
                    title: "Check your input",
                    description: "Page must be at least 1.",
                    color: EMBED_COLORS.error,
                },
            ],
        });
    });

    test("renders unavailable commands as ephemeral error embeds", async () => {
        const { ctx, interaction } = createContext();

        await ctx.respondUnavailable("Guild only.");

        expect(interaction.reply).toHaveBeenCalledWith({
            ephemeral: true,
            embeds: [
                {
                    type: EmbedType.Rich,
                    title: "Command unavailable",
                    description: "Guild only.",
                    color: EMBED_COLORS.error,
                },
            ],
        });
    });
});
