import { EmbedType, type Embed } from "lilybird";

interface CommandErrorLogEmbedOptions {
    commandName: string;
    subCommand?: string;
    isInteraction: boolean;
    user: {
        id: string;
        username: string;
    };
    guildName: string;
    guildId?: string;
    channelId?: string;
    content?: string;
    error: Error;
}

export function commandErrorDisplayName(commandName: string, subCommand: string | undefined, isInteraction: boolean): string {
    return isInteraction && subCommand ? `${commandName} -> ${subCommand}` : commandName;
}

export function commandErrorLogEmbed({
    commandName,
    subCommand,
    isInteraction,
    user,
    guildName,
    guildId,
    channelId,
    content,
    error,
}: CommandErrorLogEmbedOptions): Embed.Structure {
    const fields = [
        { name: "User", value: `<@${user.id}> (${user.username})` },
        { name: "Guild", value: guildId && channelId ? `[${guildName}](https://discord.com/channels/${guildId}/${channelId})` : guildName },
    ];

    if (!isInteraction && content) {
        fields.push({ name: "Message", value: truncateField(content) });
    }

    fields.push({ name: "Error", value: error.stack ? truncateField(error.stack) : "undefined (look at logs)" });

    return {
        type: EmbedType.Rich,
        title: `Runtime error on command${isInteraction ? " (slash)" : ""}: ${commandErrorDisplayName(commandName, subCommand, isInteraction)}`,
        fields,
    };
}

function truncateField(value: string): string {
    return value.length > 1024 ? value.slice(0, 1021) + "..." : value;
}
