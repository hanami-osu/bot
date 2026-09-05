import { CommandData } from "@type/commands";
import { DiscordLinkRequest, DiscordLinkResponse } from "@type/hanami";
import { CommandContext } from "@utils/command-context";
import { simpleErrorEmbed, simpleInfoEmbed } from "../../embed-builders/common";
import { getEntry } from "@utils/database";
import { Tables } from "@type/database";
import { safeParse } from "@utils/safe-parse";
import { v2 } from "osu-api-extended";
import { Mode } from "@type/osu";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    const databaseUser = await getEntry(Tables.USER, ctx.user.id);

    const userData: DiscordLinkRequest = {
        discordUserId: ctx.user.id,
        username: ctx.user.username,
        displayName: ctx.user.globalName ?? ctx.user.username,
        avatarUrl: ctx.user.avatarURL(),
    };

    const ticketInfo = await fetchTempTicketLink(userData);

    if (ticketInfo === null) {
        await ctx.editReply({ embeds: [simpleErrorEmbed("Please try again in a moment.", "Couldn't create a link")] });
        return;
    }

    const expiryTimestamp = Math.floor(new Date(ticketInfo.expiresAt).getTime() / 1000);

    let linkText = `[Continue to Hanami Web](<${ticketInfo.url}>) to link your osu! account or manage your settings.\nThis link expires <t:${expiryTimestamp}:R>.`;
    let avatarUrl: string | undefined = undefined;
    if (databaseUser?.banchoId) {
        const osuUserRequest = await safeParse(v2.users.details({ user: databaseUser.banchoId, mode: Mode.OSU }));
        if (!osuUserRequest.success) {
            await ctx.editReply({ embeds: [simpleErrorEmbed("Something went REALLLLLYYY wrong..\nPlease contact @yorunoken to fix this, how did you even break it this hard?", "What the hell.. how?")] });
            return;
        }

        const osuUser = osuUserRequest.data;
        linkText = `It looks like you're already to osu! user \`${osuUser.username}\`\n[Continue to Hanami Web](<${ticketInfo.url}>) to re-link your osu! account or manage your settings.\nThis link expires <t:${expiryTimestamp}:R>.`;
        avatarUrl = osuUser.avatar_url;
    }

    await ctx.editReply({
        embeds: [
            simpleInfoEmbed(
                linkText,
                "Link your osu! account",
                avatarUrl,
            ),
        ],
    });
}

async function fetchTempTicketLink(userData: DiscordLinkRequest): Promise<DiscordLinkResponse | null> {
    const webUrl = process.env.HANAMI_WEB_URL;
    const botLinkSecret = process.env.BOT_LINK_SECRET;

    if (!webUrl || !botLinkSecret) {
        throw new Error("HANAMI_WEB_URL and BOT_LINK_SECRET must be configured");
    }

    try {
        const res = await fetch(new URL("/api/internal/discord-link-ticket", webUrl), {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${botLinkSecret}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
        });

        if (!res.ok) {
            return null;
        }

        const data: unknown = await res.json().catch(() => null);

        if (!isDiscordLinkResponse(data)) {
            return null;
        }

        return data;
    } catch {
        return null;
    }
}

function isDiscordLinkResponse(value: unknown): value is DiscordLinkResponse {
    if (typeof value !== "object" || value === null || !("url" in value) || !("expiresAt" in value)) {
        return false;
    }

    return typeof value.url === "string" && typeof value.expiresAt === "string";
}

export const data = {
    name: "link",
    description: "Link your osu! account to the bot.",
    hasPrefixVariant: false,
} satisfies CommandData;
