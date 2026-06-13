import { CommandData } from "@type/commands";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    const { interaction } = ctx;
    await interaction!.deferReply(true);

    const authUrl = process.env.OSU_AUTH_URL;
    await interaction!.editReply(`You can [click here](<${authUrl}>) to sign into Hanami Web, and link your osu! account.. or manage your configurations!`);
}

export const data = {
    name: "link",
    description: "Link your osu! account to the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
