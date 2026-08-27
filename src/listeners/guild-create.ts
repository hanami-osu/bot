import { getEntry, insertData } from "@utils/database";
import { Tables } from "@type/database";
import type { Guild } from "@type/database";
import { guildPrefixesCache } from "@state/guild-prefixes";
import { $listener } from "@utils/lilybird-handler";
import type { ClientListeners } from "lilybird";
import type { DefaultTransformers } from "@lilybird/transformers";

type GuildCreatePayload = Parameters<NonNullable<ClientListeners<DefaultTransformers>["guildCreate"]>>[0];

$listener({
    event: "guildCreate",
    handle: async (guild: GuildCreatePayload) => {
        // build temporarily unavailable, return.
        if (!("name" in guild)) return;

        const document = await getEntry(Tables.GUILD, guild.id);

        const data: Array<{ key: keyof Guild; value: string | number | null }> = [
            { key: "name", value: guild.name },
            { key: "owner_id", value: guild.ownerId },
            { key: "joined_at", value: guild.joinedAt },
        ];

        if (document === null) data.push({ key: "prefixes", value: null });

        await insertData({
            table: Tables.GUILD,
            id: guild.id,
            data,
        });

        if (document?.prefixes) guildPrefixesCache.set(guild.id, document.prefixes);
    },
});
