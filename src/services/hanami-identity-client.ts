import type { BotIdentityResponse } from "@type/identity";

const REQUEST_BODY_LIMIT_BYTES = 1024;
const RESPONSE_BODY_LIMIT_BYTES = 4096;
const DEFAULT_TIMEOUT_MS = 3000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 10_000;
const MAX_DECIMAL_IDENTIFIER = 18_446_744_073_709_551_615n;

type FetchImplementation = typeof fetch;

export interface HanamiIdentityClientConfig {
    endpoint: string;
    currentSecret: string;
    previousSecret?: string;
    timeoutMs?: number;
    production?: boolean;
}

export class HanamiIdentityClientError extends Error {
    constructor(
        message: string,
        public readonly code: "configuration" | "unauthorized" | "unavailable" | "protocol",
        public readonly allowsDegradedCache: boolean,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "HanamiIdentityClientError";
    }
}

export interface HanamiIdentityClientLike {
    resolve(discordId: string): Promise<BotIdentityResponse>;
}

function parseTimeout(value: string | undefined): number {
    if (typeof value === "undefined" || value.length === 0) return DEFAULT_TIMEOUT_MS;
    const timeout = Number(value);
    if (!Number.isInteger(timeout) || timeout < MIN_TIMEOUT_MS || timeout > MAX_TIMEOUT_MS) {
        throw new HanamiIdentityClientError(`BOT_IDENTITY_REQUEST_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`, "configuration", false);
    }
    return timeout;
}

function normalizeEndpoint(rawEndpoint: string, production: boolean): string {
    let endpoint: URL;
    try {
        endpoint = new URL(rawEndpoint);
    } catch (error) {
        throw new HanamiIdentityClientError("HANAMI_WEB_IDENTITY_URL must be an absolute URL", "configuration", false, { cause: error });
    }

    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
        throw new HanamiIdentityClientError("HANAMI_WEB_IDENTITY_URL cannot contain credentials, a query, or a fragment", "configuration", false);
    }
    if (production && endpoint.protocol !== "https:") {
        throw new HanamiIdentityClientError("HANAMI_WEB_IDENTITY_URL must use HTTPS in production", "configuration", false);
    }
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
        throw new HanamiIdentityClientError("HANAMI_WEB_IDENTITY_URL must use HTTP or HTTPS", "configuration", false);
    }

    return endpoint.toString();
}

export function isDecimalProviderId(value: unknown): value is string {
    if (typeof value !== "string" || !/^[1-9]\d{0,19}$/.test(value)) return false;
    try {
        return BigInt(value) <= MAX_DECIMAL_IDENTIFIER;
    } catch {
        return false;
    }
}

function isIdentityVersion(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: Array<string>): boolean {
    const actualKeys = Object.keys(value).sort();
    const sortedExpectedKeys = [...expectedKeys].sort();
    return actualKeys.length === sortedExpectedKeys.length && actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function isCanonicalUserId(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 255 && value.trim() === value;
}

function isTimestamp(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 64 && !Number.isNaN(Date.parse(value));
}

export function parseBotIdentityResponse(value: unknown): BotIdentityResponse {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new HanamiIdentityClientError("Hanami Web returned an invalid identity response", "protocol", false);
    }

    const response = value as Record<string, unknown>;
    if (response.status === "active") {
        const expectedKeys = ["status", "hanamiUserId", "discordId", "osuId", "identityVersion", "updatedAt"];
        if (
            !hasExactKeys(response, expectedKeys) ||
            !isCanonicalUserId(response.hanamiUserId) ||
            !isDecimalProviderId(response.discordId) ||
            !isDecimalProviderId(response.osuId) ||
            !isIdentityVersion(response.identityVersion) ||
            !isTimestamp(response.updatedAt)
        ) {
            throw new HanamiIdentityClientError("Hanami Web returned an invalid active identity response", "protocol", false);
        }

        return response as BotIdentityResponse;
    }

    if (response.status === "incomplete" || response.status === "not_found" || response.status === "conflict") {
        if (!hasExactKeys(response, ["status", "identityVersion"]) || !isIdentityVersion(response.identityVersion)) {
            throw new HanamiIdentityClientError("Hanami Web returned an invalid inactive identity response", "protocol", false);
        }
        return response as BotIdentityResponse;
    }

    throw new HanamiIdentityClientError("Hanami Web returned an unknown identity status", "protocol", false);
}

async function readLimitedBody(response: Response): Promise<string> {
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
        if (!/^\d+$/.test(contentLength) || Number(contentLength) > RESPONSE_BODY_LIMIT_BYTES) {
            throw new HanamiIdentityClientError("Hanami Web identity response exceeded the body limit", "protocol", false);
        }
    }

    if (!response.body) return "";

    const reader = response.body.getReader();
    const chunks: Array<Uint8Array> = [];
    let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > RESPONSE_BODY_LIMIT_BYTES) {
            await reader.cancel();
            throw new HanamiIdentityClientError("Hanami Web identity response exceeded the body limit", "protocol", false);
        }
        chunks.push(value);
    }

    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
}

export class HanamiIdentityClient implements HanamiIdentityClientLike {
    private readonly endpoint: string;
    private readonly currentSecret: string;
    private readonly previousSecret?: string;
    private readonly timeoutMs: number;

    constructor(
        config: HanamiIdentityClientConfig,
        private readonly fetchImplementation: FetchImplementation = fetch,
    ) {
        const currentSecret = config.currentSecret.trim();
        const previousSecret = config.previousSecret?.trim();
        if (!currentSecret) {
            throw new HanamiIdentityClientError("HANAMI_BOT_SERVICE_SECRET is required", "configuration", false);
        }

        this.endpoint = normalizeEndpoint(config.endpoint, config.production ?? process.env.NODE_ENV === "production");
        this.currentSecret = currentSecret;
        this.previousSecret = previousSecret && previousSecret !== currentSecret ? previousSecret : undefined;
        this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < MIN_TIMEOUT_MS || this.timeoutMs > MAX_TIMEOUT_MS) {
            throw new HanamiIdentityClientError(`identity request timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds`, "configuration", false);
        }
    }

    async resolve(discordId: string): Promise<BotIdentityResponse> {
        if (!isDecimalProviderId(discordId)) {
            throw new HanamiIdentityClientError("Discord provider account ID must be a positive decimal identifier", "protocol", false);
        }

        let response = await this.request(discordId, this.currentSecret);
        if ((response.status === 401 || response.status === 403) && this.previousSecret) {
            response = await this.request(discordId, this.previousSecret);
        }

        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel();
            throw new HanamiIdentityClientError("Hanami Web rejected the Bot service credential", "unauthorized", false);
        }
        if (response.status === 429 || response.status >= 500) {
            await response.body?.cancel();
            throw new HanamiIdentityClientError("Hanami Web identity service is temporarily unavailable", "unavailable", true);
        }
        if (!response.ok) {
            await response.body?.cancel();
            throw new HanamiIdentityClientError("Hanami Web rejected the identity request", "protocol", false);
        }

        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!contentType.startsWith("application/json")) {
            await response.body?.cancel();
            throw new HanamiIdentityClientError("Hanami Web identity response must be JSON", "protocol", false);
        }

        const body = await readLimitedBody(response);
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch (error) {
            throw new HanamiIdentityClientError("Hanami Web identity response was not valid JSON", "protocol", false, { cause: error });
        }

        const identity = parseBotIdentityResponse(parsed);
        if (identity.status === "active" && identity.discordId !== discordId) {
            throw new HanamiIdentityClientError("Hanami Web returned an identity for a different Discord account", "protocol", false);
        }
        return identity;
    }

    private async request(discordId: string, secret: string): Promise<Response> {
        const body = JSON.stringify({ discordId });
        if (new TextEncoder().encode(body).byteLength > REQUEST_BODY_LIMIT_BYTES) {
            throw new HanamiIdentityClientError("Hanami Web identity request exceeded the body limit", "protocol", false);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.fetchImplementation(this.endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json",
                },
                body,
                cache: "no-store",
                credentials: "omit",
                redirect: "error",
                signal: controller.signal,
            });
        } catch (error) {
            throw new HanamiIdentityClientError("Hanami Web identity request failed", "unavailable", true, { cause: error });
        } finally {
            clearTimeout(timeout);
        }
    }
}

export function createHanamiIdentityClientFromEnvironment(fetchImplementation: FetchImplementation = fetch): HanamiIdentityClient {
    return new HanamiIdentityClient(
        {
            endpoint: process.env.HANAMI_WEB_IDENTITY_URL ?? "",
            currentSecret: process.env.HANAMI_BOT_SERVICE_SECRET ?? "",
            previousSecret: process.env.HANAMI_BOT_SERVICE_SECRET_PREVIOUS,
            timeoutMs: parseTimeout(process.env.BOT_IDENTITY_REQUEST_TIMEOUT_MS),
        },
        fetchImplementation,
    );
}
