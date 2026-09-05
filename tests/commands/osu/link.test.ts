import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../../src/embed-builders/common";
import { CommandContext } from "../../../src/utils/command-context";

const originalFetch = globalThis.fetch;
const getEntry = mock(() => Promise.resolve<any>(null));
const getUserDetails = mock(() => Promise.resolve<any>({ username: "peppy", avatar_url: "https://a.ppy.sh/2" }));

mock.module("@utils/database", () => ({ getEntry }));
mock.module("osu-api-extended", () => ({ v2: { users: { details: getUserDetails } } }));

const { run } = await import("../../../src/commands/osu/link");

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
        getEntry.mockReset();
        getEntry.mockResolvedValue(null);
        getUserDetails.mockReset();
        getUserDetails.mockResolvedValue({ username: "peppy", avatar_url: "https://a.ppy.sh/2" });
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

    test("finishes the deferred response when a stored Bancho ID is malformed", async () => {
        getEntry.mockResolvedValueOnce({ banchoId: "malformed" });
        getUserDetails.mockRejectedValueOnce(new Error("invalid user"));
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
            embeds: [expect.objectContaining({ color: EMBED_COLORS.error })],
        });
    });
});
