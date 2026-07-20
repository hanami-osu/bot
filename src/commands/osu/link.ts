import { CommandData } from "@type/commands";
import type { DiscordLinkRequest } from "@type/hanami";
import { HanamiWebClientError, hanamiWebClient } from "../../clients/hanami-web-client";
import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    const userData: DiscordLinkRequest = {
        discordUserId: ctx.user.id,
        username: ctx.user.username,
        displayName: ctx.user.globalName ?? ctx.user.username,
        avatarUrl: ctx.user.avatarURL(),
    };

    let ticketInfo;
    try {
        ticketInfo = await hanamiWebClient.createDiscordLinkTicket(userData);
    } catch (error) {
        if (!(error instanceof HanamiWebClientError)) throw error;
        await ctx.editReply("Something went wrong. Maybe try again?");
        return;
    }

    const expiryTimestamp = Math.floor(new Date(ticketInfo.expiresAt).getTime() / 1000);

    await ctx.editReply(
        `You can [click here](<${ticketInfo.url}>) to sign into Hanami Web, and link your osu! account.. or manage your configurations! (expires <t:${expiryTimestamp}:R>)`,
    );
}

export const data = {
    name: "link",
    description: "Link your osu! account to the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
