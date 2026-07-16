import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";
import type { HanamiIdentityResolution } from "../../../src/types/identity";

const resolutionEnabledMock = mock(() => false);
const resolveIdentityMock = mock((): Promise<HanamiIdentityResolution> => Promise.resolve({ status: "not_found" }));
class MockIdentityUnavailableError extends Error {}

mock.module("@services/identity-resolver", () => ({
    HanamiIdentityUnavailableError: MockIdentityUnavailableError,
    isBotIdentityResolutionEnabled: resolutionEnabledMock,
    resolveHanamiIdentity: resolveIdentityMock,
}));

const { run } = await import("../../../src/commands/osu/link");
const originalWebUrl = process.env.HANAMI_WEB_URL;

function createContext() {
    const interaction = {
        member: { user: { id: "123456789012345678", username: "test_user" } },
        inGuild: mock(() => true),
        inDM: mock(() => false),
        deferReply: mock(() => Promise.resolve()),
        editReply: mock(() => Promise.resolve()),
    } as any;
    return { interaction, ctx: new CommandContext({} as any, interaction, undefined, [], undefined, "link") };
}

describe("link command", () => {
    beforeEach(() => {
        process.env.HANAMI_WEB_URL = "https://hanami.gg";
        resolutionEnabledMock.mockImplementation(() => false);
        resolveIdentityMock.mockImplementation(() => Promise.resolve({ status: "not_found" }));
    });

    afterEach(() => {
        process.env.HANAMI_WEB_URL = originalWebUrl;
    });

    test("offers fixed registration and login destinations before resolver cutover", async () => {
        const { ctx, interaction } = createContext();
        await run(ctx);

        expect(resolveIdentityMock).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("https://hanami.gg/register"));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("https://hanami.gg/login"));
    });

    test.each([
        [{ status: "active", identity: { hanamiUserId: "user", discordId: "123456789012345678", osuId: "1", identityVersion: 1 }, source: "web" }, "/account"],
        [{ status: "incomplete" }, "/account/complete"],
        [{ status: "not_found" }, "/register"],
    ] as const)("routes resolved account state %# to its fixed destination", async (resolution, destination) => {
        resolutionEnabledMock.mockImplementation(() => true);
        resolveIdentityMock.mockImplementationOnce(() => Promise.resolve(resolution));
        const { ctx, interaction } = createContext();

        await run(ctx);

        expect(resolveIdentityMock).toHaveBeenCalledWith("123456789012345678");
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining(`https://hanami.gg${destination}`));
    });

    test("blocks conflicts with a support message", async () => {
        resolutionEnabledMock.mockImplementation(() => true);
        resolveIdentityMock.mockImplementationOnce(() => Promise.resolve({ status: "conflict" }));
        const { ctx, interaction } = createContext();

        await run(ctx);

        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("contact Hanami support"));
    });
});
