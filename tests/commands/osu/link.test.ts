import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../../src/embed-builders/common";
import { run } from "../../../src/commands/osu/link";
import { CommandContext } from "../../../src/utils/command-context";

const originalFetch = globalThis.fetch;

function createContext(): { ctx: CommandContext; editReply: ReturnType<typeof mock> } {
    const editReply = mock(() => Promise.resolve());
    const interaction = {
        member: {
            user: {
                id: "user-1",
                username: "tester",
                globalName: "Tester",
                avatarURL: () => "https://example.com/avatar.png",
            },
        },
        inGuild: () => true,
        inDM: () => false,
        deferReply: mock(() => Promise.resolve()),
        editReply,
    } as any;

    return { ctx: new CommandContext({} as any, interaction), editReply };
}

describe("link command", () => {
    beforeEach(() => {
        process.env.HANAMI_WEB_URL = "https://hanami.example";
        process.env.BOT_LINK_SECRET = "test-secret";
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        Reflect.deleteProperty(process.env, "HANAMI_WEB_URL");
        Reflect.deleteProperty(process.env, "BOT_LINK_SECRET");
    });

    test("presents a temporary sign-in link in an informational embed", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({ url: "https://hanami.example/link/ticket", expiresAt: "2026-09-04T20:00:00.000Z" }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                ),
            ),
        ) as unknown as typeof fetch;
        const { ctx, editReply } = createContext();

        await run(ctx);

        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Link your osu! account",
                    color: EMBED_COLORS.brand,
                    description: expect.stringContaining("https://hanami.example/link/ticket"),
                }),
            ],
        });
    });

    test("uses a clear error embed when a sign-in link cannot be created", async () => {
        globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 500 }))) as unknown as typeof fetch;
        const { ctx, editReply } = createContext();

        await run(ctx);

        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Couldn't create a link",
                    color: EMBED_COLORS.error,
                    description: "Please try again in a moment.",
                }),
            ],
        });
    });
});
