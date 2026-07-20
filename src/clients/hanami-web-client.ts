import type { DiscordLinkRequest, DiscordLinkResponse } from "@type/hanami";

export type HanamiWebClientErrorKind = "configuration" | "timeout" | "http" | "invalid-response" | "network";

export class HanamiWebClientError extends Error {
    constructor(
        public readonly kind: HanamiWebClientErrorKind,
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = "HanamiWebClientError";
    }
}

interface HanamiWebClientDependencies {
    fetch?: (input: URL | Request | string, init?: RequestInit) => Promise<Response>;
    webUrl?: string;
    botLinkSecret?: string;
    timeoutMs?: number;
}

function isDiscordLinkResponse(value: unknown): value is DiscordLinkResponse {
    return (
        typeof value === "object" &&
        value !== null &&
        "url" in value &&
        "expiresAt" in value &&
        typeof value.url === "string" &&
        typeof value.expiresAt === "string"
    );
}

export function createHanamiWebClient({
    fetch: fetchImpl = globalThis.fetch,
    webUrl = process.env.HANAMI_WEB_URL,
    botLinkSecret = process.env.BOT_LINK_SECRET,
    timeoutMs = 6000,
}: HanamiWebClientDependencies = {}) {
    return {
        async createDiscordLinkTicket(request: DiscordLinkRequest): Promise<DiscordLinkResponse> {
            if (!webUrl || !botLinkSecret) {
                throw new HanamiWebClientError("configuration", "HANAMI_WEB_URL and BOT_LINK_SECRET must be configured");
            }
            const signal = AbortSignal.timeout(timeoutMs);
            let response: Response;
            try {
                response = await fetchImpl(new URL("/api/internal/discord-link-ticket", webUrl), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${botLinkSecret}`, "Content-Type": "application/json" },
                    body: JSON.stringify(request),
                    signal,
                });
            } catch (_error) {
                if (signal.aborted) throw new HanamiWebClientError("timeout", `Hanami Web request timed out after ${timeoutMs}ms`);
                throw new HanamiWebClientError("network", "Hanami Web request failed", undefined);
            }
            if (!response.ok) throw new HanamiWebClientError("http", `Hanami Web returned HTTP ${response.status}`, response.status);
            let data: unknown;
            try {
                data = await response.json();
            } catch {
                throw new HanamiWebClientError("invalid-response", "Hanami Web returned invalid JSON");
            }
            if (!isDiscordLinkResponse(data))
                throw new HanamiWebClientError("invalid-response", "Hanami Web returned an invalid link ticket");
            return data;
        },
    };
}

export const hanamiWebClient = createHanamiWebClient();
