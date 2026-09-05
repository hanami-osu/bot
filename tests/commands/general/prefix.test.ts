import { beforeEach, describe, expect, mock, test } from "bun:test";
import { PermissionFlags } from "lilybird";
import { EMBED_COLORS } from "../../../src/embed-builders/common";
import { guildPrefixesCache } from "../../../src/state/guild-prefixes";
import { Tables } from "../../../src/types/database";
import { CommandContext } from "../../../src/utils/command-context";

const getEntry = mock(() => Promise.resolve<any>({ id: "guild-1", prefixes: null }));
const insertData = mock(() => Promise.resolve());

mock.module("@utils/database", () => ({
    getEntry,
    insertData,
    bulkInsertData: mock(() => Promise.resolve()),
}));

const { run } = await import("../../../src/commands/general/prefix");

function createContext(subCommand: string, prefix?: string, permissions = String(PermissionFlags.MANAGE_GUILD)) {
    const editReply = mock(() => Promise.resolve());
    const interaction = {
        guildId: "guild-1",
        member: {
            permissions,
            user: { id: "user-1", username: "tester" },
        },
        data: {
            subCommand,
            getString: () => prefix,
        },
        inGuild: () => true,
        inDM: () => false,
        deferReply: mock(() => Promise.resolve()),
        editReply,
    } as any;

    return { ctx: new CommandContext({} as any, interaction), editReply };
}

describe("prefix command responses", () => {
    beforeEach(() => {
        getEntry.mockReset();
        getEntry.mockResolvedValue({ id: "guild-1", prefixes: null });
        insertData.mockClear();
        guildPrefixesCache.clear();
    });

    test("explains missing permissions with an error embed", async () => {
        const { ctx, editReply } = createContext("add", "!", "0");

        await run(ctx);

        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Missing permissions",
                    color: EMBED_COLORS.error,
                    description: expect.stringContaining("Manage Server"),
                }),
            ],
        });
        expect(insertData).not.toHaveBeenCalled();
    });

    test("confirms a newly added prefix", async () => {
        const { ctx, editReply } = createContext("add", "!");

        await run(ctx);

        expect(insertData).toHaveBeenCalledWith({
            table: Tables.GUILD,
            id: "guild-1",
            data: [{ key: "prefixes", value: JSON.stringify(["!"]) }],
        });
        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Prefix added",
                    color: EMBED_COLORS.success,
                    description: "`!` is ready to use :3",
                }),
            ],
        });
    });

    test("warns when removing the final custom prefix", async () => {
        getEntry.mockResolvedValueOnce({ id: "guild-1", prefixes: ["!"] });
        const { ctx, editReply } = createContext("remove", "!");

        await run(ctx);

        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Using the default prefix",
                    color: EMBED_COLORS.warning,
                    description: expect.stringContaining("default prefix"),
                }),
            ],
        });
    });

    test("shows the default prefix when no custom prefixes exist", async () => {
        const { ctx, editReply } = createContext("list");

        await run(ctx);

        expect(editReply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Using the default prefix",
                    color: EMBED_COLORS.brand,
                }),
            ],
        });
    });
});
