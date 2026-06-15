import { removeEntry } from "@utils/database";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import { guildPrefixesCache } from "@utils/cache";
import { $listener } from "@utils/lilybird-handler";

$listener({
    event: "guildDelete",
    handle: async (_, guild) => {
        await removeEntry(Tables.GUILD, guild.id);
        try {
            guildPrefixesCache.delete(guild.id);
        } catch (error) {
            logger.error(`Failed to remove guild ${guild.id} from prefix cache`, error as Error);
        }
    },
});
