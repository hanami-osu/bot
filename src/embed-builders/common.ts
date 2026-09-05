import { EmbedType, type Embed } from "lilybird";

export const EMBED_COLORS = {
    brand: 0xffc0cb,
    success: 0x57f287,
    warning: 0xfee75c,
    error: 0xed4245,
} as const;

interface EmbedReply {
    embeds?: Array<Embed.Structure>;
}

export function applyDefaultEmbedColor<T extends EmbedReply>(reply: T): T {
    if (!reply.embeds) return reply;

    return {
        ...reply,
        embeds: reply.embeds.map(embed => (typeof embed.color === "number" ? embed : { ...embed, color: EMBED_COLORS.brand })),
    };
}

function statusEmbed(description: string, title: string, color: number, thumbnailUrl?: string): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title,
        description,
        color,
        thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
    };
}

export function simpleErrorEmbed(description: string, title = "Something went wrong", thumbnailUrl?: string): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.error, thumbnailUrl);
}

export function simpleInfoEmbed(description: string, title: string, thumbnailUrl?: string): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.brand, thumbnailUrl);
}

export function simpleSuccessEmbed(description: string, title = "All set!", thumbnailUrl?: string): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.success, thumbnailUrl);
}

export function simpleWarningEmbed(description: string, title = "Heads up!", thumbnailUrl?: string): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.warning, thumbnailUrl);
}

export function userNotFoundEmbed(userId: string | number): Embed.Structure {
    return simpleErrorEmbed(`I couldn't find an osu! user matching **\`${userId}\`**.`, "Nothing found");
}

export function missingBeatmapEmbed(): Embed.Structure {
    return simpleErrorEmbed("I couldn't find a beatmap in your command or recent channel messages.", "Nothing found");
}

export function beatmapNotFoundEmbed(): Embed.Structure {
    return simpleErrorEmbed("I couldn't find that beatmap.", "Nothing found");
}
