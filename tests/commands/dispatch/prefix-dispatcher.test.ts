import { afterEach, describe, expect, mock, test } from "bun:test";
import { dispatchPrefixCommand } from "../../../src/commands/dispatch/prefix-dispatcher";
import { commandsCache, slashCommandIdsCache } from "../../../src/state/command-registry";
import { cooldownsCache } from "../../../src/state/cooldowns";
import { guildPrefixesCache } from "../../../src/state/guild-prefixes";
import { wysiEmoji } from "../../../src/utils/constants";
import type { CommandFileData } from "../../../src/types/commands";

describe("prefix dispatcher", () => {
    afterEach(() => {
        commandsCache.clear();
        slashCommandIdsCache.clear();
        cooldownsCache.clear();
        guildPrefixesCache.clear();
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

        await dispatchPrefixCommand({
            content: ";config",
            guildId: "guild123",
            client: { rest: { triggerTypingIndicator: mock(() => Promise.resolve()) } },
            author: { id: "user123", bot: false },
            reply,
            react: mock(() => Promise.resolve()),
            fetchChannel,
        } as any);

        expect(reply).toHaveBeenCalledWith({
            content: "The `config` command can only be used as a slash command. Try </config:command123>.",
            allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
        });
        expect(run).not.toHaveBeenCalled();
        expect(fetchChannel).not.toHaveBeenCalled();
        expect(cooldownsCache.has("config:user123")).toBe(false);
    });

    test("handles non-command wysi messages", async () => {
        const react = mock(() => Promise.resolve());

        await dispatchPrefixCommand({
            content: "727",
            guildId: "guild123",
            client: { rest: { triggerTypingIndicator: mock(() => Promise.resolve()) } },
            author: { id: "user123", bot: false },
            reply: mock(() => Promise.resolve()),
            react,
            fetchChannel: mock(() => Promise.resolve({ isText: () => true })),
        } as any);

        expect(react).toHaveBeenCalledWith(wysiEmoji, true);
    });
});
