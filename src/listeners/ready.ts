import { $listener } from "@utils/lilybird-handler";
import { loadCommands, refreshGuildsDatabase, loadGuildPrefixes } from "@utils/initialize";
import { logger } from "@utils/logger";
import { markReady } from "@utils/readiness";

$listener({
    event: "ready",
    handle: async (client) => {
        logger.info(`Successfully logged in as ${client.user.username} ✅`);
        await loadCommands(client);
        logger.info("Loaded commands ✅");
        await refreshGuildsDatabase();
        logger.info("Refreshed servers database ✅");
        await loadGuildPrefixes();
        await markReady();
    },
});
