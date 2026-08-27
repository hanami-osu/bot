import { afterEach, describe, expect, mock, test } from "bun:test";
import { EmbedBuilderType, type EmbedBuilderOptions } from "../../src/types/builders";

const get = mock(() => Promise.resolve<EmbedBuilderOptions | null>(null));
const set = mock(() => Promise.resolve(true));
const buildPlayPaginationMessageOptions = mock(() => Promise.resolve({ content: "rendered page" }));

mock.module("@state/button-state-cache", () => ({
    ButtonStateCache: { get, set },
}));
mock.module("@services/play-service", () => ({ buildPlayPaginationMessageOptions }));

const { handlePaginationInteraction } = await import("../../src/interactions/pagination-handler");

function createButtonInteraction(reply: ReturnType<typeof mock>) {
    return {
        isMessageComponentInteraction: () => true,
        isModalSubmitInteraction: () => false,
        data: {
            isButton: () => true,
            id: "increment-page",
        },
        message: {
            id: "message-1",
            channelId: "channel-1",
        },
        reply,
    };
}

describe("pagination interaction runtime", () => {
    afterEach(() => {
        get.mockClear();
        set.mockClear();
        buildPlayPaginationMessageOptions.mockClear();
    });

    test("handles expired pagination state with an ephemeral response", async () => {
        get.mockResolvedValueOnce(null);
        const reply = mock(() => Promise.resolve());

        const handled = await handlePaginationInteraction(createButtonInteraction(reply) as never);

        expect(handled).toBe(true);
        expect(get).toHaveBeenCalledWith("message-1");
        expect(reply).toHaveBeenCalledWith({
            ephemeral: true,
            content: "This button will not work because the message was created before a bot restart, so its data has been lost.",
        });
    });

    test("rejects pagination input from a user other than the command initiator", async () => {
        get.mockResolvedValueOnce({
            type: EmbedBuilderType.PLAYS,
            initiatorId: "owner-user",
            plays: [],
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            page: 0,
            isPage: true,
        } as unknown as EmbedBuilderOptions);
        const reply = mock(() => Promise.resolve());
        const interaction = {
            ...createButtonInteraction(reply),
            inGuild: () => true,
            inDM: () => false,
            member: { user: { id: "other-user" } },
        };

        const handled = await handlePaginationInteraction(interaction as never);

        expect(handled).toBe(true);
        expect(reply).toHaveBeenCalledWith({
            ephemeral: true,
            content: "You need to be the person who initialized the command to be able to interact with this.",
        });
        expect(set).not.toHaveBeenCalled();
    });

    test("updates cached state and edits the message for an authorized page button", async () => {
        const builderOptions = {
            type: EmbedBuilderType.PLAYS,
            initiatorId: "owner-user",
            plays: Array.from({ length: 6 }, () => ({})),
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            page: 0,
            isPage: true,
        } as unknown as EmbedBuilderOptions;
        get.mockResolvedValueOnce(builderOptions);

        const reply = mock(() => Promise.resolve());
        const updateComponents = mock(() => Promise.resolve());
        const editReply = mock(() => Promise.resolve());
        const interaction = {
            ...createButtonInteraction(reply),
            inGuild: () => true,
            inDM: () => false,
            member: { user: { id: "owner-user" } },
            updateComponents,
            editReply,
        };

        const handled = await handlePaginationInteraction(interaction as never);

        expect(handled).toBe(true);
        expect(updateComponents).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith("message-1", expect.objectContaining({ page: 1, isPage: true }));
        expect(buildPlayPaginationMessageOptions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, isPage: true }));
        expect(editReply).toHaveBeenCalledWith({ content: "rendered page" });
    });
});
