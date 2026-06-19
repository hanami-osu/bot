import { DEFAULT_PREFIX, wysiEmoji } from "@utils/constants";
import { commandAliasesCache, commandsCache, slashCommandIdsCache } from "@utils/cache";
import { logger } from "@utils/logger";
import { incrementCommandCount } from "@utils/database";
import { guildPrefixesCache, cooldownsCache } from "@utils/cache";
import { deprecatedEmbed } from "embed-builders/deprecated-prefix";
import { handleCommandError } from "@utils/error";
import { CommandContext } from "@utils/command-context";
import { $listener } from "@utils/lilybird-handler";

const CHANCE_TO_SEND_CUTE_KITTY_CAT_I_LOVE_CATS = 0.2;

$listener({
    event: "messageCreate",
    handle: async (message) => {
        const { content, guildId, client, author } = message;
        if (!content || !guildId || author.bot) return;

        // I guess this is fine since guilds can have a max of 10 prefixes
        const guildPrefixes: Array<string> = guildPrefixesCache.get(guildId) ?? DEFAULT_PREFIX;
        let chosenPrefix: string | null = null;
        for (const guildPrefix of guildPrefixes) {
            if (content.startsWith(guildPrefix)) {
                chosenPrefix = guildPrefix;
                break;
            }
        }

        if (chosenPrefix === null) {
            // nyann :3333
            if ((content === ":3" || content === "3:") && Math.random() < CHANCE_TO_SEND_CUTE_KITTY_CAT_I_LOVE_CATS) {
                await message.reply(message.content === ":3" ? "3:" : ":3", { allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] } });
                return;
            }

            const wysiArr = ["727", "7,27", "72,7", "72.7", "7.27", "wysi"];
            if (wysiArr.some((wysi) => content.toLowerCase() === wysi)) {
                await message.react(wysiEmoji, true);
            }
            return;
        }

        const args = content.slice(chosenPrefix.length).trim().split(/ +/g);
        let commandName = args.shift()?.toLowerCase();
        if (typeof commandName === "undefined") return;

        let index: number | undefined;
        const match = /^(\D+)(\d+)$/.exec(commandName);
        if (match) {
            const [, extractedCommandName, extractedNumber] = match;
            commandName = extractedCommandName;
            index = Number.parseInt(extractedNumber, 10) - 1;
        }

        const alias = commandAliasesCache.get(commandName);
        const command = alias ? commandsCache.get(alias) : commandsCache.get(commandName);

        if (!command) return; // Removed fuzzy matching

        const { data } = command;

        if (!data.hasPrefixVariant) {
            await message.reply({
                content: `The \`${data.name}\` command can only be used as a slash command. Try ${getSlashCommandMention(data.name)}.`,
                allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
            });
            return;
        }

        // Check cooldown
        const cooldownExpiry = cooldownsCache.get(`${data.name}:${author.id}`);
        if (cooldownExpiry && cooldownExpiry > Date.now()) {
            const remainingTime = cooldownExpiry - Date.now();
            try {
                const sentMessage = await message.reply({
                    content: `Please wait \`${remainingTime}ms\` before executing this command again`,
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

        // set cooldown before executing command
        cooldownsCache.set(`${data.name}:${author.id}`, Date.now() + (data.message?.cooldown ?? 1000));

        // return simple deprecation notice only if explicitly requested
        if (!command.run && !command.runMessage && data.isDeprecatedPrefix) {
            const embed = deprecatedEmbed(data.name);
            await message.reply({ embeds: embed });
            return;
        }

        if (!command.run && !command.runMessage) return;

        const channel = await message.fetchChannel();
        if (!channel.isText()) return;

        // normally this would need `await`, but I don't want the bot to wait while it's sending the request.
        client.rest.triggerTypingIndicator(channel.id);

        let commandContext: CommandContext | undefined;

        try {
            if (command.run) {
                commandContext = new CommandContext(client, undefined, message, args, chosenPrefix, commandName, channel, index);
                await command.run(commandContext);
            } else if (command.runMessage) {
                await command.runMessage({ client: client, message, args, prefix: chosenPrefix, index, commandName, channel });
            }

            // Increment command count only if no errors were found
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
    },
});

function getSlashCommandMention(commandName: string): string {
    const commandId = slashCommandIdsCache.get(commandName);
    return commandId ? `</${commandName}:${commandId}>` : `/${commandName}`;
}
