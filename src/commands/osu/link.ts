import { CommandData } from "@type/commands";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    await ctx.editReply(`You can [click here](<${hanamiUrl}>) to sign into Hanami Web, and link your osu! account.. or manage your configurations!`);
}

async function fetchTempLinkTicket() {
    const res = await fetch(`${process.env.HANAMI_WEB_URL}/api/internal/discord-link-ticket`, {
        headers: { Authorization: `Bearer ${1}`, "Content-Type": "application/json" },
    });
}

export const data = {
    name: "link",
    description: "Link your osu! account to the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
