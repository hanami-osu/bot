import { describe, expect, mock, test } from "bun:test";
import { EmbedBuilderType, type EmbedBuilderOptions } from "../../src/types/builders";

const set = mock(() => Promise.resolve(true));
const loggerWarn = mock(() => Promise.resolve());

mock.module("../../src/state/button-state-cache", () => ({
    ButtonStateCache: {
        get: mock(() => Promise.resolve(null)),
        set,
    },
}));
mock.module("../../src/utils/logger", () => ({
    logger: { warn: loggerWarn },
}));

const { CommandContext } = await import("../../src/utils/command-context");

describe("CommandContext pagination", () => {
    test("caches interaction pagination state from the edit response before returning", async () => {
        const editReply = mock(() => Promise.resolve({ id: "response-1" }));
        const getOriginalInteractionResponse = mock(() => Promise.resolve({ id: "response-1" }));
        const interaction = {
            editReply,
        } as any;
        const client = {
            rest: { getOriginalInteractionResponse },
        } as any;
        const ctx = new CommandContext(client, interaction);
        const embedOptions = {
            type: EmbedBuilderType.PLAYS,
            initiatorId: "user-1",
            plays: [],
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            page: 0,
            isPage: true,
        } as unknown as EmbedBuilderOptions;

        await ctx.sendWithPagination({ content: "page" }, embedOptions);

        expect(editReply).toHaveBeenCalledWith({ content: "page" });
        expect(set).toHaveBeenCalledWith("response-1", embedOptions);
        expect(getOriginalInteractionResponse).not.toHaveBeenCalled();
    });

    test("does not fail an interaction response when Redis caching fails", async () => {
        const cacheError = new Error("redis unavailable");
        set.mockRejectedValueOnce(cacheError);
        const interaction = {
            editReply: mock(() => Promise.resolve({ id: "response-2" })),
        } as any;
        const client = {
            rest: { getOriginalInteractionResponse: mock(() => Promise.resolve({ id: "response-2" })) },
        } as any;
        const ctx = new CommandContext(client, interaction);
        const embedOptions = {
            type: EmbedBuilderType.PLAYS,
            initiatorId: "user-1",
            plays: [],
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            page: 0,
            isPage: true,
        } as unknown as EmbedBuilderOptions;

        await expect(ctx.sendWithPagination({ content: "page" }, embedOptions)).resolves.toBeUndefined();

        expect(loggerWarn).toHaveBeenCalledWith("Could not cache interaction pagination state", { error: cacheError });
    });

    test("does not fail a message response when Redis caching fails", async () => {
        const cacheError = new Error("redis unavailable");
        set.mockRejectedValueOnce(cacheError);
        const sentMessage = {
            id: "message-response-1",
            edit: mock(() => Promise.resolve()),
        };
        const message = {
            reply: mock(() => Promise.resolve(sentMessage)),
        } as any;
        const ctx = new CommandContext({} as any, undefined, message);
        const embedOptions = {
            type: EmbedBuilderType.PLAYS,
            initiatorId: "user-1",
            plays: [],
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            page: 0,
            isPage: true,
        } as unknown as EmbedBuilderOptions;

        await expect(ctx.sendWithPagination({ content: "page" }, embedOptions)).resolves.toBeUndefined();

        expect(set).toHaveBeenCalledWith("message-response-1", embedOptions);
        expect(loggerWarn).toHaveBeenCalledWith("Could not cache message pagination state", { error: cacheError });
    });
});
