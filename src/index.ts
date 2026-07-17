import { initializeDatabase, initializeOsuApi } from "@utils/initialize";
import { logger } from "@utils/logger";
import { closeRedis, initializeRedis } from "./state/redis";
import { prisma } from "@utils/database";
import { clearReady } from "@utils/readiness";
import { CachingDelegationType, createClient, Intents, type Client } from "lilybird";
import { cacheKeys, Channel, defaultTransformers, Guild, GuildVoiceChannel } from "@lilybird/transformers";
import { handler } from "@utils/lilybird-handler";

const SHUTDOWN_TIMEOUT_MS = 8_000;

let discordClient: Client | null = null;
let shutdownPromise: Promise<void> | null = null;

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = SHUTDOWN_TIMEOUT_MS): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs).unref();
        }),
    ]);
}

async function shutdown(reason: string, exitCode: number): Promise<void> {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
        await logger.info(`Shutting down: ${reason}`);

        if (discordClient) {
            discordClient.close();
            discordClient = null;
        }

        await clearReady().catch((error: unknown) => logger.error("Error clearing readiness marker", asError(error)));
        await withTimeout(closeRedis(), "Redis shutdown").catch((error: unknown) => logger.error("Error closing Redis", asError(error)));
        await withTimeout(prisma.$disconnect(), "Prisma shutdown").catch((error: unknown) =>
            logger.error("Error disconnecting Prisma", asError(error)),
        );
        await withTimeout(logger.flush(), "Logger flush").catch((error: unknown) => console.error("Error flushing logs", error));

        process.exitCode = exitCode;
    })();

    return shutdownPromise;
}

function registerProcessHandlers(): void {
    process.once("SIGINT", () => {
        void shutdown("SIGINT", 0).finally(() => process.exit(process.exitCode ?? 0));
    });
    process.once("SIGTERM", () => {
        void shutdown("SIGTERM", 0).finally(() => process.exit(process.exitCode ?? 0));
    });
    process.once("unhandledRejection", (reason: unknown) => {
        const error = asError(reason);
        void logger.fatal("Unhandled promise rejection", error).finally(() => {
            void shutdown("unhandledRejection", 1).finally(() => process.exit(process.exitCode ?? 1));
        });
    });
    process.once("uncaughtException", (error: Error) => {
        void logger.fatal("Uncaught exception", error).finally(() => {
            void shutdown("uncaughtException", 1).finally(() => process.exit(process.exitCode ?? 1));
        });
    });
}

async function main(): Promise<void> {
    registerProcessHandlers();

    try {
        await clearReady();
        await initializeOsuApi();
        await initializeRedis();
        await initializeDatabase();

        await handler.scanDir(`${import.meta.dir}/listeners`);
        discordClient = await createClient({
            token: process.env.DISCORD_BOT_TOKEN,
            transformers: defaultTransformers,
            customCacheKeys: cacheKeys,

            caching: {
                transformerTypes: {
                    channel: Channel,
                    guild: Guild,
                    voiceState: GuildVoiceChannel,
                },
                delegate: CachingDelegationType.DEFAULT,
                applyTransformers: true,
                enabled: {
                    channel: true,
                },
            },

            intents: [Intents.GUILDS, Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT],
            listeners: handler.getListenersObject(false),
        });
    } catch (error) {
        await logger.fatal("Startup failed", asError(error));
        await shutdown("startup failure", 1);
        process.exit(process.exitCode ?? 1);
    }
}

await main();
