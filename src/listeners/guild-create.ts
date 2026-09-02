import { getEntry, insertData } from "@utils/database";
import { Tables } from "@type/database";
import type { Guild } from "@type/database";
import { guildPrefixesCache } from "@state/guild-prefixes";
import { $listener } from "@utils/lilybird-handler";
import { welcomeBuilder } from "../embed-builders/help";
import { logger } from "@utils/logger";
import type { ClientListeners } from "lilybird";
import type { DefaultTransformers } from "@lilybird/transformers";

type GuildCreatePayload = Parameters<NonNullable<ClientListeners<DefaultTransformers>["guildCreate"]>>[0];

async function sendWelcomeMessage(guild: Extract<GuildCreatePayload, { name: string }>): Promise<void> {
    const textChannels = guild.channels
        .filter(channel => channel.isText() || channel.isAnnouncement())
        .sort((first, second) => first.position - second.position);
    const systemChannel = textChannels.find(channel => channel.id === guild.systemChannelId);
    const candidates = systemChannel
        ? [systemChannel, ...textChannels.filter(channel => channel.id !== systemChannel.id)]
        : textChannels;
    let lastError: unknown;

    for (const channel of candidates) {
        try {
            await channel.send({ embeds: [welcomeBuilder()] });
            return;
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        await logger.warn("Could not send guild welcome message", {
            error: lastError,
            guildId: guild.id,
        });
    }
}

$listener({
    event: "guildCreate",
    handle: async (guild: GuildCreatePayload) => {
        // build temporarily unavailable, return.
        if (!("name" in guild)) return;

        const document = await getEntry(Tables.GUILD, guild.id);

        const metadata: Array<{ key: keyof Guild; value: string | number | null }> = [
            { key: "name", value: guild.name },
            { key: "owner_id", value: guild.ownerId },
            { key: "joined_at", value: guild.joinedAt },
        ];

        const created = await insertData(
            {
                table: Tables.GUILD,
                id: guild.id,
                data: [...metadata, { key: "prefixes", value: null }],
            },
            true,
        );
        if (!created) await insertData({
            table: Tables.GUILD,
            id: guild.id,
            data: metadata,
        });

        if (document?.prefixes) guildPrefixesCache.set(guild.id, document.prefixes);
        if (created) await sendWelcomeMessage(guild);
    },
});
