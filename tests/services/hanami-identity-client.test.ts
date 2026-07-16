import { describe, expect, mock, test } from "bun:test";
import { HanamiIdentityClient, HanamiIdentityClientError, parseBotIdentityResponse } from "../../src/services/hanami-identity-client";

const activeResponse = {
    status: "active" as const,
    hanamiUserId: "hanami-user-1",
    discordId: "123456789012345678",
    osuId: "12345",
    identityVersion: 2,
    updatedAt: "2026-07-17T10:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("Hanami identity Web client", () => {
    test("posts the exact server contract with the current service secret", async () => {
        const requests: Array<{ input: string; init?: RequestInit }> = [];
        const fetchImplementation = mock((input: string | URL | Request, init?: RequestInit) => {
            requests.push({ input: input.toString(), init });
            return Promise.resolve(jsonResponse(activeResponse));
        }) as unknown as typeof fetch;
        const client = new HanamiIdentityClient(
            {
                endpoint: "http://127.0.0.1:3000/api/internal/bot/identity",
                currentSecret: "current-secret",
                timeoutMs: 1000,
                production: false,
            },
            fetchImplementation,
        );

        await expect(client.resolve(activeResponse.discordId)).resolves.toEqual(activeResponse);
        expect(requests).toHaveLength(1);
        expect(requests[0]?.input).toBe("http://127.0.0.1:3000/api/internal/bot/identity");
        expect(requests[0]?.init?.method).toBe("POST");
        expect(requests[0]?.init?.body).toBe(JSON.stringify({ discordId: activeResponse.discordId }));
        expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe("Bearer current-secret");
        expect(new Headers(requests[0]?.init?.headers).get("Content-Type")).toBe("application/json");
        expect(requests[0]?.init?.credentials).toBe("omit");
        expect(requests[0]?.init?.redirect).toBe("error");
    });

    test("retries the previous secret only after current-secret authentication failure", async () => {
        const authorizations: Array<string | null> = [];
        const fetchImplementation = mock((_input: string | URL | Request, init?: RequestInit) => {
            const authorization = new Headers(init?.headers).get("Authorization");
            authorizations.push(authorization);
            return Promise.resolve(authorization === "Bearer current-secret" ? new Response(null, { status: 401 }) : jsonResponse(activeResponse));
        }) as unknown as typeof fetch;
        const client = new HanamiIdentityClient(
            {
                endpoint: "http://127.0.0.1:3000/api/internal/bot/identity",
                currentSecret: "current-secret",
                previousSecret: "previous-secret",
                timeoutMs: 1000,
                production: false,
            },
            fetchImplementation,
        );

        await expect(client.resolve(activeResponse.discordId)).resolves.toEqual(activeResponse);
        expect(authorizations).toEqual(["Bearer current-secret", "Bearer previous-secret"]);
    });

    test("does not use the previous secret for service failures", async () => {
        const fetchImplementation = mock(() => Promise.resolve(new Response(null, { status: 503 }))) as unknown as typeof fetch;
        const client = new HanamiIdentityClient(
            {
                endpoint: "http://127.0.0.1:3000/api/internal/bot/identity",
                currentSecret: "current-secret",
                previousSecret: "previous-secret",
                timeoutMs: 1000,
                production: false,
            },
            fetchImplementation,
        );

        await expect(client.resolve(activeResponse.discordId)).rejects.toMatchObject({ code: "unavailable", allowsDegradedCache: true });
        expect(fetchImplementation).toHaveBeenCalledTimes(1);
    });

    test("strictly rejects extra fields and mismatched Discord identities", async () => {
        expect(() => parseBotIdentityResponse({ ...activeResponse, email: "hidden@example.invalid" })).toThrow(HanamiIdentityClientError);

        const fetchImplementation = mock(() => Promise.resolve(jsonResponse({ ...activeResponse, discordId: "999" }))) as unknown as typeof fetch;
        const client = new HanamiIdentityClient(
            {
                endpoint: "http://127.0.0.1:3000/api/internal/bot/identity",
                currentSecret: "current-secret",
                timeoutMs: 1000,
                production: false,
            },
            fetchImplementation,
        );
        await expect(client.resolve(activeResponse.discordId)).rejects.toMatchObject({ code: "protocol", allowsDegradedCache: false });
    });

    test("rejects response bodies above four KiB", async () => {
        const fetchImplementation = mock(() =>
            Promise.resolve(
                new Response(JSON.stringify({ ...activeResponse, padding: "x".repeat(5000) }), {
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        ) as unknown as typeof fetch;
        const client = new HanamiIdentityClient(
            {
                endpoint: "http://127.0.0.1:3000/api/internal/bot/identity",
                currentSecret: "current-secret",
                timeoutMs: 1000,
                production: false,
            },
            fetchImplementation,
        );

        await expect(client.resolve(activeResponse.discordId)).rejects.toMatchObject({ code: "protocol" });
    });

    test("requires HTTPS for production endpoints", () => {
        expect(
            () =>
                new HanamiIdentityClient({
                    endpoint: "http://hanami.gg/api/internal/bot/identity",
                    currentSecret: "current-secret",
                    production: true,
                }),
        ).toThrow("must use HTTPS");
    });
});
