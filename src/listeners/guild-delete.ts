import { removeEntry } from "@utils/database";
import { Tables } from "@type/database";
import { guildPrefixesCache } from "@state/guild-prefixes";
import { $listener } from "@utils/lilybird-handler";
import { logger } from "@utils/logger";

$listener({
    event: "guildDelete",
    handle: async (_, guild) => {
        if (guild.unavailable) return;

        guildPrefixesCache.delete(guild.id);
        try {
            await removeEntry(Tables.GUILD, guild.id);
        } catch (error) {
            await logger.error("Guild delete listener failed", error, { guildId: guild.id });
        }
    },
});
