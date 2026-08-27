import { createClient, type RedisClientType } from "redis";
import { logger } from "@utils/logger";

let redisClient: RedisClientType;

export async function initializeRedis(): Promise<void> {
    logger.info("Initializing Redis connection...");

    redisClient = createClient({
        url: process.env.REDIS_URL,
    });

    redisClient.on("error", (error: Error) => {
        logger.error("Redis connection error:", error);
    });

    redisClient.on("connect", () => {
        logger.info("Redis connecting...");
    });

    redisClient.on("ready", () => {
        logger.info("Redis connected successfully");
    });

    redisClient.on("end", () => {
        logger.warn("Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
        logger.info("Redis reconnecting...");
    });

    try {
        await redisClient.connect();
    } catch (error) {
        logger.error("Failed to connect to Redis:", error as Error);
        throw new Error(`Redis connection failed: ${(error as Error).message}`);
    }
}

export function isRedisAvailable(): boolean {
    return redisClient && redisClient.isOpen;
}

export function stringifyForCache(value: unknown): string {
    return JSON.stringify(value, (_key, nestedValue: unknown) =>
        typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    );
}

export function getRedisClient(): RedisClientType {
    return redisClient;
}

export async function closeRedis(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.quit();
            logger.info("Redis connection closed gracefully");
        } catch (error) {
            logger.error("Error closing Redis connection", error as Error);
            await redisClient.disconnect();
        }
    }
}
