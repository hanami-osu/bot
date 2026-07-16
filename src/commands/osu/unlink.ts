import type { CommandData } from "@type/commands";
import { CommandContext } from "@utils/command-context";
import { getHanamiAccountUrl } from "@utils/hanami-account-url";

export async function run(ctx: CommandContext): Promise<void> {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    await ctx.editReply(
        `A Hanami account permanently combines its Discord and osu! identities, so individual providers cannot be unlinked. Use [Hanami account management](<${getHanamiAccountUrl("account")}>) to review or delete the complete account.`,
    );
}

export const data = {
    name: "unlink",
    description: "Learn how unified Hanami account identity is managed.",
    hasPrefixVariant: false,
} satisfies CommandData;
