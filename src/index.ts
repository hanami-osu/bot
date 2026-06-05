import { initializeDatabase, initializeOsuApi } from "@utils/initialize";
import { logger } from "@utils/logger";
import { initializeRedis, closeRedis } from "@utils/cache";
import { createHandler } from "@lilybird/handlers/simple";
import { CachingDelegationType, createClient, Intents } from "lilybird";
import { Channel, Guild, GuildVoiceChannel } from "@lilybird/transformers";

await initializeOsuApi();

// Initialize Redis
await initializeRedis();

process.on("unhandledRejection", async (error: Error) => {
    console.error("Unhandled promise rejection stack:", error);
    await logger.fatal("Unhandled promise rejection", error);
});
process.on("uncaughtException", async (error: Error) => {
    await logger.fatal("Uncaught exception", error);
});

async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
        await closeRedis();
        await logger.flush();
        process.exit(0);
    } catch (error) {
        logger.error("Error during shutdown", error as Error);
        process.exit(1);
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

(await initializeDatabase());

const listeners = await createHandler({
    dirs: {
        listeners: `${import.meta.dir}/listeners`,
    },
});


await createClient({
    token: process.env.DISCORD_BOT_TOKEN,
    caching: {
        transformerTypes: { channel: Channel, guild: Guild, voiceState: GuildVoiceChannel },
        delegate: CachingDelegationType.DEFAULT,
        applyTransformers: true,
        enabled: { channel: true },
    },
    intents: [Intents.GUILDS, Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT],
    ...listeners,
});
