import { describe, expect, test } from "bun:test";
import { createHanamiWebClient, HanamiWebClientError } from "../../src/clients/hanami-web-client";

const request = { discordUserId: "1", username: "name", displayName: "Name", avatarUrl: "https://example.com/avatar" };

describe("Hanami Web client", () => {
    test("returns a valid link ticket and sends bearer authorization", async () => {
        const fetchMock = async (_url: URL | Request | string, init?: RequestInit) => {
            expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
            return new Response(JSON.stringify({ url: "https://web.test/link", expiresAt: "2026-01-01T00:00:00.000Z" }));
        };
        await expect(
            createHanamiWebClient({ fetch: fetchMock, webUrl: "https://web.test", botLinkSecret: "secret" }).createDiscordLinkTicket(
                request,
            ),
        ).resolves.toMatchObject({ url: "https://web.test/link" });
    });

    test.each([
        [async () => new Response("no", { status: 500 }), "http"],
        [async () => new Response("not-json"), "invalid-response"],
        [async () => new Response(JSON.stringify({ url: 1 })), "invalid-response"],
    ] as const)("classifies %s responses", async (fetchMock, kind) => {
        await expect(
            createHanamiWebClient({ fetch: fetchMock, webUrl: "https://web.test", botLinkSecret: "secret" }).createDiscordLinkTicket(
                request,
            ),
        ).rejects.toMatchObject({ kind } satisfies Partial<HanamiWebClientError>);
    });

    test("reports missing configuration without exposing a secret", async () => {
        await expect(
            createHanamiWebClient({ webUrl: "https://web.test", botLinkSecret: "" }).createDiscordLinkTicket(request),
        ).rejects.toMatchObject({
            kind: "configuration",
        });
    });

    test("classifies aborted requests as timeouts", async () => {
        const fetchMock = (_url: URL | Request | string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) =>
                init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }),
            );
        await expect(
            createHanamiWebClient({
                fetch: fetchMock,
                webUrl: "https://web.test",
                botLinkSecret: "secret",
                timeoutMs: 1,
            }).createDiscordLinkTicket(request),
        ).rejects.toMatchObject({ kind: "timeout" });
    });
});
