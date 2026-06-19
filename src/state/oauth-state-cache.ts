import { RedisCache } from "./redis";

const STATE_DISCORD_TTL_SECONDS = 600;
const stateDiscordKey = (state: string): string => `state:${state}`;

export class StateCache {
    static async get(state: string): Promise<string | null> {
        return RedisCache.get<string>(stateDiscordKey(state));
    }

    static async set(state: string, discordId: string): Promise<boolean> {
        return RedisCache.set(stateDiscordKey(state), discordId, STATE_DISCORD_TTL_SECONDS);
    }

    static async del(state: string): Promise<boolean> {
        return RedisCache.del(stateDiscordKey(state));
    }
}
