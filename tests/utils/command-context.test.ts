import { describe, expect, mock, test } from "bun:test";
import { EmbedType } from "lilybird";
import { EMBED_COLORS } from "../../src/embed-builders/common";
import { CommandContext } from "../../src/utils/command-context";

describe("CommandContext", () => {
    test("uses the initial interaction reply before a response is sent", async () => {
        const mockInteraction = {
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction);

        await ctx.reply("hello");

        expect(mockInteraction.reply).toHaveBeenCalledWith("hello");
        expect(mockInteraction.editReply).not.toHaveBeenCalled();
    });

    test("edits the interaction response when reply is called after defer", async () => {
        const mockInteraction = {
            deferReply: mock(() => Promise.resolve()),
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction);

        await ctx.defer(true);
        await ctx.reply({ content: "done" });

        expect(mockInteraction.deferReply).toHaveBeenCalledWith(true);
        expect(mockInteraction.reply).not.toHaveBeenCalled();
        expect(mockInteraction.editReply).toHaveBeenCalledWith({ content: "done" });
    });

    test("adds the brand color to result embeds", async () => {
        const mockInteraction = {
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction);

        await ctx.reply({ embeds: [{ title: "Result" }] });

        expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [{ title: "Result", color: EMBED_COLORS.brand }] });
    });

    test("leaves help embeds unchanged for the later help redesign", async () => {
        const mockInteraction = {
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction, undefined, [], undefined, "help");

        await ctx.reply({ embeds: [{ title: "Help" }] });

        expect(mockInteraction.reply).toHaveBeenCalledWith({ embeds: [{ title: "Help" }] });
    });

    test("renders validation failures as error embeds after defer", async () => {
        const mockInteraction = {
            deferReply: mock(() => Promise.resolve()),
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction);

        await ctx.defer();
        await ctx.respondError("Page must be at least 1.", "Check your input");

        expect(mockInteraction.editReply).toHaveBeenCalledWith({
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
        const mockInteraction = {
            reply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction);

        await ctx.respondUnavailable("Guild only.");

        expect(mockInteraction.reply).toHaveBeenCalledWith({
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
