import { getEntry, removeEntry } from "@utils/database";
import { Tables } from "@type/database";
import { CommandData } from "@type/commands";
import { slashCommandIdsCache } from "@utils/cache";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    const { interaction } = ctx;
    await interaction!.deferReply(true);

    const linkCommandId = slashCommandIdsCache.get("link");
    const linkCommand = linkCommandId ?? "/link";
    const userId = ctx.user.id;
    const user = await getEntry(Tables.USER, userId);
    if (!user?.banchoId) {
        await interaction!.editReply(`You are not linked to the bot! You can link your account by using ${linkCommand} to visit Hanami Web.`);
        return;
    }

    await removeEntry(Tables.USER, userId);
    await interaction!.editReply(`Sad to see you go :(\nYou can always re-link yourself by using ${linkCommand} to visit Hanami Web!`);
}

export const data = {
    name: "unlink",
    description: "Unlink your osu! account from the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
