import { createClient, RedisClientType } from "redis";
import { logger } from "@utils/logger";
import { CommandFileData } from "@type/commands";
import type { EmbedBuilderOptions } from "@type/builders";

// Map caches
export const commandsCache = new Map<string, CommandFileData>();
export const commandAliasesCache = new Map<string, string>();

export const guildPrefixesCache = new Map<string, Array<string>>();
export const cooldownsCache = new Map<string, number>();
export const slashCommandIdsCache = new Map<string, string>();

// Clear cooldown cache every hour
setInterval(
    () => {
        const now = Date.now();
        for (const [key, expiresAt] of cooldownsCache.entries()) {
            if (expiresAt <= now) {
                cooldownsCache.delete(key);
            }
        }
    },
    5 * 60 * 1000,
);

// Redis client instance
let redisClient: RedisClientType;

export async function initializeRedis(): Promise<void> {
    logger.info("Initializing Redis connection...");

    redisClient = createClient({
        url: process.env.REDIS_URL,
    });

    // Set up error handler before connecting
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

function isRedisAvailable(): boolean {
    return redisClient && redisClient.isOpen;
}

const CacheKeys = {
    BUTTON_STATE: (messageId: string) => `button:${messageId}:state`,
    STATE_DISCORD: (state: string) => `state:${state}`,
} as const;

const CacheTTL = {
    BUTTON_STATE: 3600, // 1 hour
    STATE_DISCORD: 600, // 10 minutes
} as const;

const BUTTON_STATE_VERSION = 1;

function stringifyForCache(value: unknown): string {
    return JSON.stringify(value, (_key, nestedValue: unknown) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function encodeButtonState(state: EmbedBuilderOptions): string {
    return stringifyForCache({ version: BUTTON_STATE_VERSION, state });
}

export function decodeButtonState(serialized: string): EmbedBuilderOptions | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(serialized);
    } catch {
        return null;
    }

    if (!isRecord(parsed) || parsed.version !== BUTTON_STATE_VERSION || !isRecord(parsed.state)) {
        return null;
    }

    if (typeof parsed.state.type !== "string" || typeof parsed.state.initiatorId !== "string") {
        return null;
    }

    return parsed.state as unknown as EmbedBuilderOptions;
}

class RedisCache {
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

// Specialized cache classes for different data types
export class ButtonStateCache {
    static async get(messageId: string): Promise<EmbedBuilderOptions | null> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for GET operation on key: ${CacheKeys.BUTTON_STATE(messageId)}`);
        }

        const data = await redisClient.get(CacheKeys.BUTTON_STATE(messageId));
        return data ? decodeButtonState(data) : null;
    }

    static async set(messageId: string, value: EmbedBuilderOptions): Promise<boolean> {
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for SET operation on key: ${CacheKeys.BUTTON_STATE(messageId)}`);
        }

        await redisClient.setEx(CacheKeys.BUTTON_STATE(messageId), CacheTTL.BUTTON_STATE, encodeButtonState(value));
        return true;
    }
}

export class StateCache {
    static async get(state: string): Promise<string | null> {
        return RedisCache.get<string>(CacheKeys.STATE_DISCORD(state));
    }

    static async set(state: string, discordId: string): Promise<boolean> {
        return RedisCache.set(CacheKeys.STATE_DISCORD(state), discordId, CacheTTL.STATE_DISCORD);
    }

    static async del(state: string): Promise<boolean> {
        return RedisCache.del(CacheKeys.STATE_DISCORD(state));
    }
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
