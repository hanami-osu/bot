import { CommandData } from "@type/commands";
import { DiscordLinkRequest, DiscordLinkResponse } from "@type/hanami";
import { CommandContext } from "@utils/command-context";
import { getEntry } from "@utils/database";
import { Tables } from "@type/database";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    const userId = ctx.user.id;
    const user = await getEntry(Tables.USER, userId);

    if (user?.banchoId) {
        const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: "osu" }));
        if (!osuUserRequest.success) {
            await ctx.editReply("Something went wrong. Maybe try again?");
            return;
        }

        const osuUser = osuUserRequest.data;
        const userData: DiscordLinkRequest = {
            discordUserId: ctx.user.id,
            username: ctx.user.username,
            displayName: ctx.user.globalName ?? ctx.user.username,
            avatarUrl: ctx.user.avatarURL(),
        };

        const ticketInfo = await fetchTempTicketLink(userData);

        if (ticketInfo === null) {
            await ctx.editReply("Something went wrong. Maybe try again?");
            return;
        }

        const expiryTimestamp = Math.floor(new Date(ticketInfo.expiresAt).getTime() / 1000);

        await ctx.editReply(
            `You are already linked to **${osuUser.username}**.\n\n` +
            `Want to re-link? You can [click here](<${ticketInfo.url}>) to sign into Hanami Web and re-link your account. (expires <t:${expiryTimestamp}:R>)`,
        );
        return;
    }

    const userData: DiscordLinkRequest = {
        discordUserId: ctx.user.id,
        username: ctx.user.username,
        displayName: ctx.user.globalName ?? ctx.user.username,
        avatarUrl: ctx.user.avatarURL(),
    };

    const ticketInfo = await fetchTempTicketLink(userData);

    if (ticketInfo === null) {
        await ctx.editReply("Something went wrong. Maybe try again?");
        return;
    }

    const expiryTimestamp = Math.floor(new Date(ticketInfo.expiresAt).getTime() / 1000);

    await ctx.editReply(
        `You can [click here](<${ticketInfo.url}>) to sign into Hanami Web, and link your osu! account.. or manage your configurations! (expires <t:${expiryTimestamp}:R>)`,
    );
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
                Authorization: `Bearer ${botLinkSecret}`,
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
