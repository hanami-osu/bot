import { describe, expect, mock, test } from "bun:test";
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
});
