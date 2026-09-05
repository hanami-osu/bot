import { afterEach, describe, expect, mock, test } from "bun:test";
import { dispatchPrefixCommand } from "../../../src/commands/dispatch/prefix-dispatcher";
import { commandsCache, slashCommandIdsCache } from "../../../src/state/command-registry";
import { cooldownsCache } from "../../../src/state/cooldowns";
import { guildPrefixesCache } from "../../../src/state/guild-prefixes";
import { wysiEmoji } from "../../../src/utils/constants";
import type { CommandFileData } from "../../../src/types/commands";
import { EMBED_COLORS } from "../../../src/embed-builders/common";

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

    test("shows cooldowns as a short warning instead of raw milliseconds", async () => {
        const run = mock(() => Promise.resolve());
        commandsCache.set("ping", {
            data: {
                name: "ping",
                description: "Check latency.",
                hasPrefixVariant: true,
            },
            run,
        } satisfies CommandFileData);
        cooldownsCache.set("ping:user123", Date.now() + 1000);

        const deleteReply = mock(() => Promise.resolve());
        const reply = mock(() => Promise.resolve({ id: "cooldown", delete: deleteReply }));

        await dispatchPrefixCommand({
            content: ";ping",
            guildId: "guild123",
            client: { rest: { triggerTypingIndicator: mock(() => Promise.resolve()) } },
            author: { id: "user123", bot: false },
            reply,
            react: mock(() => Promise.resolve()),
            fetchChannel: mock(() => Promise.resolve({ isText: () => true })),
        } as any);

        expect(reply).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    title: "Easy there :3",
                    description: "This command is still cooling down. Try again in **1 second**.",
                    color: EMBED_COLORS.warning,
                }),
            ],
            allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
        });
        expect(run).not.toHaveBeenCalled();
    });
});
