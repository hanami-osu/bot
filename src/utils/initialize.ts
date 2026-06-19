import { prisma, removeEntry } from "@utils/database";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import { auth } from "osu-api-extended";
export { loadCommands } from "../commands/loader";
export { loadGuildPrefixes } from "../state/guild-prefixes";

export async function initializeOsuApi(): Promise<void> {
    await auth.login({
        type: "v2",
        client_id: Number(process.env.OSU_CLIENT_ID),
        client_secret: process.env.OSU_CLIENT_SECRET,
        cachedTokenPath: process.env.OSU_TOKEN_PATH || "./osu-token.json",
        scopes: ["public"],
    });
}

export async function refreshGuildsDatabase(): Promise<void> {
    const nulledGuilds = await prisma.guild.findMany({ where: { name: null } });

    if (nulledGuilds.length === 0) return;

    for (const guild of nulledGuilds) {
        logger.info(`Removed guild: ${guild.name} (${guild.id})`);
        await removeEntry(Tables.GUILD, guild.id);
    }
}

export async function initializeDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info("Database up and running!");
    } catch (e) {
        await logger.error("Failed to connect to database", e as Error);
        throw e;
    }
}
