import type { EmbedBuilderOptions } from "@type/builders";
import { getRedisClient, isRedisAvailable, stringifyForCache } from "./redis";

const BUTTON_STATE_VERSION = 1;
const BUTTON_STATE_TTL_SECONDS = 3600;

const buttonStateKey = (messageId: string): string => `button:${messageId}:state`;

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

export class ButtonStateCache {
    static async get(messageId: string): Promise<EmbedBuilderOptions | null> {
        const key = buttonStateKey(messageId);
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for GET operation on key: ${key}`);
        }

        const data = await getRedisClient().get(key);
        return data ? decodeButtonState(data) : null;
    }

    static async set(messageId: string, value: EmbedBuilderOptions): Promise<boolean> {
        const key = buttonStateKey(messageId);
        if (!isRedisAvailable()) {
            throw new Error(`Redis is not available for SET operation on key: ${key}`);
        }

        await getRedisClient().setEx(key, BUTTON_STATE_TTL_SECONDS, encodeButtonState(value));
        return true;
    }
}
