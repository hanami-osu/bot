import { ChannelType, type Client, type Embed } from "lilybird";
import type { Message } from "@lilybird/transformers";

function findId(embed: Embed.Structure): number | null {
    const url = embed.url ?? embed.author?.url;
    if (!url || /\/(user|u)/.test(url)) return null;
    const match = /osu\.ppy\.sh\/(?:b|beatmaps)\/(\d+)/.exec(url);
    return match ? Number(match[1]) : null;
}

export async function getBeatmapIdFromContext({
    client,
    message,
    channelId,
}: {
    client: Client;
    message?: Message;
    channelId?: string;
}): Promise<number | null> {
    if (message?.referencedMessage)
        return typeof message.referencedMessage.embeds === "undefined" ? null : findId(message.referencedMessage.embeds[0]);
    const sourceChannelId = message?.channelId ?? channelId;
    if (!sourceChannelId) return null;
    const channel = await client.rest.getChannel(sourceChannelId);
    if (!channel.id || channel.type !== ChannelType.GUILD_TEXT) return null;
    const messages = await client.rest.getChannelMessages(channel.id, { limit: 10 });
    for (const candidate of messages)
        if (candidate.embeds.length > 0 && candidate.author.bot) {
            const id = findId(candidate.embeds[0]);
            if (id) return id;
        }
    return null;
}
