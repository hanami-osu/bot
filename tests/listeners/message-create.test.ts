import { afterEach, describe, expect, mock, test } from "bun:test";
import { commandsCache, slashCommandIdsCache } from "../../src/state/command-registry";
import { cooldownsCache } from "../../src/state/cooldowns";
import { guildPrefixesCache } from "../../src/state/guild-prefixes";
import { handler } from "../../src/utils/lilybird-handler";
import type { CommandFileData } from "../../src/types/commands";
import { EMBED_COLORS } from "../../src/embed-builders/common";

await import("../../src/listeners/message-create");

const listeners = handler.getListenersObject(false) as {
    messageCreate: (message: unknown) => Promise<void>;
};

describe("messageCreate listener", () => {
    afterEach(() => {
        commandsCache.delete("config");
        cooldownsCache.delete("config:user123");
        guildPrefixesCache.delete("guild123");
        slashCommandIdsCache.delete("config");
    });

    test("replies when a known command has no prefix variant", async () => {
        const run = mock(() => Promise.resolve());
        commandsCache.set("config", {
            data: {
                name: "config",
                description: "Change bot configuration.",
                hasPrefixVariant: false,
            },
            run,
        } satisfies CommandFileData);
        slashCommandIdsCache.set("config", "command123");

        const reply = mock(() => Promise.resolve());
        const fetchChannel = mock(() => Promise.resolve({ isText: () => true }));

        await listeners.messageCreate({
            content: ";config",
            guildId: "guild123",
            client: { rest: { triggerTypingIndicator: mock(() => Promise.resolve()) } },
            author: { id: "user123", bot: false },
            reply,
            react: mock(() => Promise.resolve()),
            fetchChannel,
        });

        expect(reply).toHaveBeenCalledWith({
            allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
            embeds: [
                expect.objectContaining({
                    title: "Slash command only",
                    description: "The `config` command can only be used as a slash command. Try </config:command123>.",
                    color: EMBED_COLORS.brand,
                }),
            ],
        });
        expect(run).not.toHaveBeenCalled();
        expect(fetchChannel).not.toHaveBeenCalled();
        expect(cooldownsCache.has("config:user123")).toBe(false);
    });
});
