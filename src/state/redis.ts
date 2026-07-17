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

export class RedisCache {
    static async get<T>(key: string): Promise<T | null> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for GET operation on key: ${key}`);
        }

        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Redis GET error for key ${key}`, error as Error);
            throw error;
        }
    }

    static async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for SET operation on key: ${key}`);
        }

        try {
            const serialized = stringifyForCache(value);
            if (ttl) {
                await redisClient.setEx(key, ttl, serialized);
            } else {
                await redisClient.set(key, serialized);
            }
            return true;
        } catch (error) {
            logger.error(`Redis SET error for key ${key}`, error as Error);
            throw error;
        }
    }

    static async del(key: string): Promise<boolean> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for DEL operation on key: ${key}`);
        }

        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            logger.error(`Redis DEL error for key ${key}`, error as Error);
            throw error;
        }
    }

    static async exists(key: string): Promise<boolean> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for EXISTS operation on key: ${key}`);
        }

        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Redis EXISTS error for key ${key}`, error as Error);
            throw error;
        }
    }
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
