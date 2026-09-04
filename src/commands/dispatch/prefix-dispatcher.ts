import { deprecatedEmbed } from "embed-builders/deprecated-prefix";
import { simpleInfoEmbed, simpleWarningEmbed } from "../../embed-builders/common";
import type { Message } from "@lilybird/transformers";
import { DEFAULT_PREFIX, wysiEmoji } from "@utils/constants";
import { CommandContext } from "@utils/command-context";
import { incrementCommandCount } from "@utils/database";
import { handleCommandError } from "@utils/error";
import { logger } from "@utils/logger";
import { getSlashCommandMention, resolveCommand } from "../../state/command-registry";
import { getCooldownExpiry, setCommandCooldown } from "../../state/cooldowns";
import { guildPrefixesCache } from "../../state/guild-prefixes";

const CHANCE_TO_SEND_CUTE_KITTY_CAT_I_LOVE_CATS = 0.2;

function findPrefix(content: string, guildId: string): string | null {
    const guildPrefixes: Array<string> = guildPrefixesCache.get(guildId) ?? DEFAULT_PREFIX;

    for (const guildPrefix of guildPrefixes) {
        if (content.startsWith(guildPrefix)) {
            return guildPrefix;
        }
    }

    return null;
}

function parseCommandName(rawCommandName: string): { commandName: string; index: number | undefined } {
    const match = /^(\D+)(\d+)$/.exec(rawCommandName);
    if (!match) return { commandName: rawCommandName, index: undefined };

    const [, commandName, extractedNumber] = match;
    return { commandName, index: Number.parseInt(extractedNumber, 10) - 1 };
}

async function handleNonCommandMessage(message: Message, content: string): Promise<void> {
    if ((content === ":3" || content === "3:") && Math.random() < CHANCE_TO_SEND_CUTE_KITTY_CAT_I_LOVE_CATS) {
        await message.reply(message.content === ":3" ? "3:" : ":3", {
            allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
        });
        return;
    }

    const wysiArr = ["727", "7,27", "72,7", "72.7", "7.27", "wysi"];
    if (wysiArr.some(wysi => content.toLowerCase() === wysi)) {
        await message.react(wysiEmoji, true);
    }
}

export async function dispatchPrefixCommand(message: Message): Promise<void> {
    const { content, guildId, client, author } = message;
    if (!content || !guildId || author.bot) return;

    const chosenPrefix = findPrefix(content, guildId);
    if (chosenPrefix === null) {
        await handleNonCommandMessage(message, content);
        return;
    }

    const args = content.slice(chosenPrefix.length).trim().split(/ +/g);
    const rawCommandName = args.shift()?.toLowerCase();
    if (typeof rawCommandName === "undefined") return;

    const { commandName, index } = parseCommandName(rawCommandName);
    const command = resolveCommand(commandName);
    if (!command) return;

    const { data } = command;

    if (!data.hasPrefixVariant) {
        await message.reply({
            embeds: [
                simpleInfoEmbed(
                    `The \`${data.name}\` command can only be used as a slash command. Try ${getSlashCommandMention(data.name)}.`,
                    "Slash command only",
                ),
            ],
            allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
        });
        return;
    }

    const cooldownExpiry = getCooldownExpiry(data.name, author.id);
    if (cooldownExpiry && cooldownExpiry > Date.now()) {
        const remainingTime = cooldownExpiry - Date.now();
        const remainingSeconds = Math.max(1, Math.ceil(remainingTime / 1000));
        const unit = remainingSeconds === 1 ? "second" : "seconds";
        try {
            const sentMessage = await message.reply({
                embeds: [
                    simpleWarningEmbed(
                        `This command is still cooling down. Try again in **${remainingSeconds} ${unit}**.`,
                        "Easy there :3",
                    ),
                ],
                allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
            });
            setTimeout(async () => {
                try {
                    await sentMessage.delete();
                } catch (deleteError) {
                    logger.warn("Could not delete cooldown message", { messageId: sentMessage.id, error: deleteError });
                }
            }, 1000);
        } catch (replyError) {
            logger.warn("Could not send cooldown message", { error: replyError });
        }
        return;
    }

    setCommandCooldown(data.name, author.id, data.message?.cooldown ?? 1000);

    if (!command.run && !command.runMessage && data.isDeprecatedPrefix) {
        const embed = deprecatedEmbed(data.name);
        await message.reply({ embeds: embed });
        return;
    }

    if (!command.run && !command.runMessage) return;

    const channel = await message.fetchChannel();
    if (!channel.isText()) return;

    client.rest.triggerTypingIndicator(channel.id).catch(() => null);

    let commandContext: CommandContext | undefined;

    try {
        if (command.run) {
            commandContext = new CommandContext(client, undefined, message, args, chosenPrefix, commandName, channel, index);
            await command.run(commandContext);
        } else if (command.runMessage) {
            await command.runMessage({ client, message, args, prefix: chosenPrefix, index, commandName, channel });
        }

        try {
            await incrementCommandCount(`${data.name}:prefix`);
        } catch (counterError) {
            await logger.warn("Could not increment prefix command counter", { command: data.name, error: counterError });
        }

        try {
            const guild = await client.rest.getGuild(guildId);
            await logger.info(`[${guild.name}] ${author.username} used prefix command \`${data.name}\``, {
                guildId,
                guildName: guild.name,
                userId: author.id,
                username: author.username,
                command: data.name,
                prefix: chosenPrefix,
            });
        } catch (logError) {
            await logger.warn("Could not write prefix command usage log", { command: data.name, userId: author.id, error: logError });
        }
    } catch (error) {
        await handleCommandError(error as Error, {
            client,
            commandContext,
            message,
            commandName: data.name,
            content,
            prefix: chosenPrefix,
        });
    }
}
