import { prisma } from "@utils/database";
import { logger } from "@utils/logger";

export const guildPrefixesCache = new Map<string, Array<string>>();

export async function loadGuildPrefixes(): Promise<void> {
    try {
        const guilds = await prisma.guild.findMany({
            where: { prefixes: { not: null } },
            select: { id: true, prefixes: true },
        });

        let loadedCount = 0;
        for (const guild of guilds) {
            try {
                if (guild.prefixes) {
                    const prefixes = JSON.parse(guild.prefixes) as Array<string>;
                    guildPrefixesCache.set(guild.id, prefixes);
                    loadedCount++;
                }
            } catch (parseError) {
                logger.error(`Failed to parse prefixes for guild ${guild.id}`, parseError as Error);
            }
        }

        logger.info(`Loaded ${loadedCount}/${guilds.length} guild prefixes into cache`);
    } catch (error) {
        logger.error("Failed to load guild prefixes", error as Error);
    }
}
