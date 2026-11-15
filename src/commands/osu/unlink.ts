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
                    `Hanami Bot isn't using an osu! account for you yet. Use ${linkCommand} to connect one.`,
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
                `Sad to see you go :(\nHanami Bot will no longer use this osu! account for your commands.${getWebAccountNotice()}\nYou can reconnect anytime with ${linkCommand}.`,
                "Account unlinked",
            ),
        ],
    });
}

// The bot link is only the bot's own preference. Any osu! identity on the Hanami account is left as is.
function getWebAccountNotice(): string {
    const webUrl = process.env.HANAMI_WEB_URL;
    if (!webUrl) return "";

    return ` Your Hanami account isn't changed. You can manage it on [Hanami Web](<${new URL("/profile", webUrl).toString()}>).`;
}

export const data = {
    name: "unlink",
    description: "Unlink your osu! account from the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
