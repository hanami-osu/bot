import { getEntry, insertData } from "@utils/database";
import { Tables } from "@type/database";
import type { CommandData } from "@type/commands";
import { getSlashCommandMention } from "../../state/command-registry";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext): Promise<void> {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    const linkCommand = getSlashCommandMention("link");
    const userId = ctx.user.id;
    const user = await getEntry(Tables.USER, userId);
    if (!user?.banchoId) {
        await ctx.editReply(`You are not linked to the bot! You can link your account by using ${linkCommand} to visit Hanami Web.`);
        return;
    }

    await insertData({ table: Tables.USER, id: userId, data: [{ key: "banchoId", value: null }] });
    await ctx.editReply(`Sad to see you go :(\nYou can always re-link yourself by using ${linkCommand} to visit Hanami Web!`);
}

export const data = {
    name: "unlink",
    description: "Unlink your osu! account from the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
