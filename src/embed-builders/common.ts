import { EmbedType, type Embed } from "lilybird";

export const EMBED_COLORS = {
    brand: 0xffc0cb,
    success: 0x57f287,
    warning: 0xfee75c,
    error: 0xed4245,
} as const;

function statusEmbed(description: string, title: string, color: number): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title,
        description,
        color,
    };
}

export function simpleErrorEmbed(description: string, title = "Something went wrong"): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.error);
}

export function simpleInfoEmbed(description: string, title: string): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.brand);
}

export function simpleSuccessEmbed(description: string, title = "All set!"): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.success);
}

export function simpleWarningEmbed(description: string, title = "Heads up!"): Embed.Structure {
    return statusEmbed(description, title, EMBED_COLORS.warning);
}

export function userNotFoundEmbed(userId: string | number): Embed.Structure {
    return simpleErrorEmbed(`I couldn't find an osu! user matching **\`${userId}\`**.`, "Nothing found");
}
