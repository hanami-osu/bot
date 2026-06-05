import { getEntry, insertData, removeEntry } from "@utils/database";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import type { Guild } from "@type/database";
import type { Event } from "@lilybird/handlers";
import { guildPrefixesCache } from "@utils/cache";

export default {
    event: "guildCreate",
    run: async (guild) => {
        // Remove guild from database if it's unavailable.
        if (!("name" in guild)) {
            (await removeEntry(Tables.GUILD, guild.id));
            return;
        }

        const document = (await getEntry(Tables.GUILD, guild.id));

        const data: Array<{ key: keyof Guild; value: string | number | null }> = [
            { key: "name", value: guild.name },
            { key: "owner_id", value: guild.ownerId },
            { key: "joined_at", value: guild.joinedAt },
        ];

        if (document === null) data.push({ key: "prefixes", value: null });

        (await insertData({
                    table: Tables.GUILD,
                    id: guild.id,
                    data,
                }));

        if (document !== null && document.prefixes !== null) {
            try {
                guildPrefixesCache.set(guild.id, document.prefixes);
            } catch (error) {
                logger.error(`Failed to cache prefixes for guild ${guild.id}`, error as Error);
            }
        }
    },
} satisfies Event<"guildCreate">;
