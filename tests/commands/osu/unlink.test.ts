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

const getEntryMock = mock((_table: Tables, _id: string) => Promise.resolve<User | null>(linkedUser));
const insertDataMock = mock(() => Promise.resolve());
const removeEntryMock = mock(() => Promise.resolve(true));

mock.module("@utils/database", () => ({
    getEntry: getEntryMock,
    insertData: insertDataMock,
    removeEntry: removeEntryMock,
}));

const { run } = await import("../../../src/commands/osu/unlink");

describe("unlink command", () => {
    beforeEach(() => {
        getEntryMock.mockImplementation((_table: Tables, _id: string) => Promise.resolve(linkedUser));
        insertDataMock.mockClear();
        removeEntryMock.mockClear();
    });

    test("clears banchoId without deleting the user row", async () => {
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
        expect(insertDataMock).toHaveBeenCalledWith({ table: Tables.USER, id: "123", data: [{ key: "banchoId", value: null }] });
        expect(removeEntryMock).not.toHaveBeenCalled();
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("Sad to see you go"));
    });

    test("does not update storage when the user is not linked", async () => {
        getEntryMock.mockImplementationOnce((_table: Tables, _id: string) => Promise.resolve({ ...linkedUser, banchoId: null }));

        const mockInteraction = {
            member: { user: { id: "123", username: "test_user" } },
            inGuild: mock(() => true),
            inDM: mock(() => false),
            deferReply: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
        } as any;
        const ctx = new CommandContext({} as any, mockInteraction, undefined, [], undefined, "unlink");

        await run(ctx);

        expect(insertDataMock).not.toHaveBeenCalled();
        expect(removeEntryMock).not.toHaveBeenCalled();
        expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining("You are not linked"));
    });
});
