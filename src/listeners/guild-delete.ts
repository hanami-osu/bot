import { removeEntry } from "@utils/database";
import { Tables } from "@type/database";
import { guildPrefixesCache } from "@state/guild-prefixes";
import { $listener } from "@utils/lilybird-handler";

$listener({
    event: "guildDelete",
    handle: async (_, guild) => {
        if (guild.unavailable) return;

        await removeEntry(Tables.GUILD, guild.id);
        guildPrefixesCache.delete(guild.id);
    },
});
