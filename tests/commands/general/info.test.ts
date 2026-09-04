import { describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../../src/embed-builders/common";
import { run as runInvite } from "../../../src/commands/general/invite";
import { run as runVote } from "../../../src/commands/general/vote";
import { CommandContext } from "../../../src/utils/command-context";

function createMessageContext(): { ctx: CommandContext; reply: ReturnType<typeof mock> } {
    const reply = mock(() => Promise.resolve());
    const message = { reply } as any;

    return { ctx: new CommandContext({} as any, undefined, message), reply };
}

describe("general information commands", () => {
    test("presents invite links in an informational embed", async () => {
        const { ctx, reply } = createMessageContext();

        await runInvite(ctx);

        expect(reply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Invite Hanami",
                    color: EMBED_COLORS.brand,
                    description: expect.stringContaining("Invite Hanami"),
                }),
            ],
        });
    });

    test("presents the vote link in an informational embed", async () => {
        const { ctx, reply } = createMessageContext();

        await runVote(ctx);

        expect(reply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Vote for Hanami",
                    color: EMBED_COLORS.brand,
                    description: expect.stringContaining("top.gg"),
                }),
            ],
        });
    });
});
