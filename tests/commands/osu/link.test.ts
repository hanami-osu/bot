import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import { Tables, type User } from "../../../src/types/database";

const linkedUser: User = {
    id: "123",
    banchoId: "yorunoken",
    score_embeds: 1,
    embed_type: null,
    mode: "osu",
    score_data: 1,
};

const unlinkedUser: User = {
    id: "456",
    banchoId: null,
    score_embeds: null,
    embed_type: null,
    mode: null,
    score_data: null,
};

const getEntryMock = mock((_table: Tables, _id: string) => Promise.resolve<User | null>(unlinkedUser));
const slashCommandIdsCache = new Map<string, string>();

mock.module("@utils/database", () => ({
    getEntry: getEntryMock,
}));

mock.module("@utils/cache", () => ({
    slashCommandIdsCache,
}));

const osuUserMock = mock(() => Promise.resolve({
    username: "yorunoken",
    userUrl: "https://osu.ppy.sh/u/12345",
}));

mock.module("osu-api-extended", () => ({
    v2: {
        users: {
            details: osuUserMock,
        },
    },
}));

const fetchMock = mock((_url: string, _options: any) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ url: "https://hanami.web/link/abc", expiresAt: "2026-08-01T00:00:00Z" }),
}));

global.fetch = fetchMock as any;

const { run } = await import("../../../src/commands/osu/link");

describe("link command", () => {
    beforeEach(() => {
        getEntryMock.mockClear();
        osuUserMock.mockClear();
        fetchMock.mockClear();
        slashCommandIdsCache.clear();
    });

    test("prompts already-linked users to re-link with their osu! account", async () => {
        getEntryMock.mockImplementation((_table: Tables, _id: string) => Promise.resolve(linkedUser));

        const mockInteraction = {
            member: {
                user: {
                    id: "123",
                    username: "test_user",
                    globalName: "Test User",
                    avatarURL: mock(() => "https://example.com/avatar"),
                },
            },
            inGuild: mock(() => true),
            inDM: mock(() => false),
            deferReply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction, undefined, [], undefined, "link");

        await run(ctx);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith(true);
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("You are already linked to"));
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("yorunoken"));
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("Want to re-link"));
    });

    test("proceeds with normal linking flow when user is not linked", async () => {
        getEntryMock.mockImplementation((_table: Tables, _id: string) => Promise.resolve(unlinkedUser));

        const mockInteraction = {
            member: {
                user: {
                    id: "456",
                    username: "new_user",
                    globalName: "New User",
                    avatarURL: mock(() => "https://example.com/avatar"),
                },
            },
            inGuild: mock(() => true),
            inDM: mock(() => false),
            deferReply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction, undefined, [], undefined, "link");

        await run(ctx);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith(true);
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("click here"));
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("link your osu! account"));
    });
});
