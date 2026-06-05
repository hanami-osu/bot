import { removeEntry } from "@utils/database";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import type { Event } from "@lilybird/handlers";
import { guildPrefixesCache } from "@utils/cache";

export default {
    event: "guildDelete",
    run: async (_, guild) => {
        (await removeEntry(Tables.GUILD, guild.id));
        try {
            guildPrefixesCache.delete(guild.id);
        } catch (error) {
            logger.error(`Failed to remove guild ${guild.id} from prefix cache`, error as Error);
        }
    },
} satisfies Event<"guildDelete">;
