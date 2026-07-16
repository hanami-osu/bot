import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../../src/utils/command-context";

const insertDataMock = mock(() => Promise.resolve());
mock.module("@utils/database", () => ({ insertData: insertDataMock }));

const { run } = await import("../../../src/commands/osu/unlink");
const originalWebUrl = process.env.HANAMI_WEB_URL;

describe("unlink command", () => {
    beforeEach(() => {
        process.env.HANAMI_WEB_URL = "https://hanami.gg";
        insertDataMock.mockClear();
    });

    afterEach(() => {
        process.env.HANAMI_WEB_URL = originalWebUrl;
    });

    test("never changes identity and directs the user to account management", async () => {
        const mockInteraction = {
            member: { user: { id: "123", username: "test_user" } },
            inGuild: mock(() => true),
            inDM: mock(() => false),
            deferReply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction, undefined, [], undefined, "unlink");

        await run(ctx);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith(true);
        expect(insertDataMock).not.toHaveBeenCalled();
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("cannot be unlinked"));
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("https://hanami.gg/account"));
    });
});
