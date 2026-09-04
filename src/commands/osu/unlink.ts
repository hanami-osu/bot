import { getEntry, insertData } from "@utils/database";
import { Tables } from "@type/database";
import type { CommandData } from "@type/commands";
import { getSlashCommandMention } from "../../state/command-registry";
import { simpleSuccessEmbed, simpleWarningEmbed } from "../../embed-builders/common";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext): Promise<void> {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    const linkCommand = getSlashCommandMention("link");
    const userId = ctx.user.id;
    const user = await getEntry(Tables.USER, userId);
    if (!user?.banchoId) {
        await ctx.editReply({
            embeds: [
                simpleWarningEmbed(
                    `You aren't linked to Hanami yet. Use ${linkCommand} to connect your osu! account.`,
                    "Nothing to unlink",
                ),
            ],
        });
        return;
    }

    await insertData({ table: Tables.USER, id: userId, data: [{ key: "banchoId", value: null }] });
    await ctx.editReply({
        embeds: [
            simpleSuccessEmbed(
                `Sad to see you go :(\nYou can reconnect anytime with ${linkCommand}.`,
                "Account unlinked",
            ),
        ],
    });
}

export const data = {
    name: "unlink",
    description: "Unlink your osu! account from the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
