import { EmbedType, type Embed } from "lilybird";

export function simpleErrorEmbed(description: string, title = "Uh oh! :x:"): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title,
        description,
    };
}

export function simpleInfoEmbed(description: string, title: string): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title,
        description,
    };
}

export function simpleSuccessEmbed(description: string, title: string): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title,
        description,
    };
}

export function userNotFoundEmbed(userId: string | number): Embed.Structure {
    return simpleErrorEmbed(`It seems like the user **\`${userId}\`** doesn't exist! :(`);
}
