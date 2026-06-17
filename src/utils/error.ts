import { EmbedType, Client } from "lilybird";
import { logger } from "@utils/logger";
import { Interaction, Message, ApplicationCommandData, GuildInteraction, DMInteraction } from "@lilybird/transformers";

interface CommandErrorContext {
    client: Client;
    interaction?: Interaction<ApplicationCommandData>;
    message?: Message;
    commandName: string;
    subCommand?: string;
    content?: string;
    prefix?: string;
}

const GENERIC_COMMAND_ERROR = "Something went wrong while running that command. The error has been logged, so please try again later.";

function isGuildInteraction(interaction: Interaction<ApplicationCommandData>): interaction is GuildInteraction<ApplicationCommandData> {
    return typeof interaction.inGuild === "function" ? interaction.inGuild() : "member" in interaction;
}

function isDMInteraction(interaction: Interaction<ApplicationCommandData>): interaction is DMInteraction<ApplicationCommandData> {
    return typeof interaction.inDM === "function" ? interaction.inDM() : "user" in interaction;
}

export async function handleCommandError(error: Error, ctx: CommandErrorContext): Promise<void> {
    const { client, interaction, message, commandName, subCommand, content, prefix } = ctx;
    const isInteraction = !!interaction;

    // Send reply to user
    try {
        if (interaction) {
            await interaction.reply({ content: GENERIC_COMMAND_ERROR, ephemeral: true });
        } else if (message) {
            await message.reply({
                content: GENERIC_COMMAND_ERROR,
                allowed_mentions: { replied_user: false, parse: [], roles: [], users: [] },
            });
        }
    } catch (replyError) {
        logger.error("Failed to send error reply to user", replyError as Error);
    }

    if (!interaction && !message) {
        await logger.error(`Command error without a Discord context for ${commandName}`, error);
        return;
    }

    const guildInteraction = interaction && isGuildInteraction(interaction) ? interaction : undefined;
    const dmInteraction = interaction && isDMInteraction(interaction) ? interaction : undefined;
    const guildId = guildInteraction?.guildId ?? message?.guildId;
    const channelId = guildInteraction?.channelId ?? message?.channelId;
    const user = guildInteraction?.member.user ?? dmInteraction?.user ?? message?.author;
    if (!user) {
        await logger.error(`Command error without user context for ${commandName}`, error);
        return;
    }

    let guildName = "Unknown Guild";
    try {
        if (guildId) {
            const guild = await client.rest.getGuild(guildId);
            guildName = guild.name;
        }
    } catch {
        // Ignored
    }

    // Build fields
    const fields = [
        { name: "User", value: `<@${user.id}> (${user.username})` },
        { name: "Guild", value: guildId && channelId ? `[${guildName}](https://discord.com/channels/${guildId}/${channelId})` : guildName },
    ];

    if (!isInteraction && content) {
        fields.push({ name: "Message", value: content.length > 1024 ? content.slice(0, 1021) + "..." : content });
    }

    fields.push({ name: "Error", value: error.stack ? (error.stack.length > 1024 ? error.stack.slice(0, 1021) + "..." : error.stack) : "undefined (look at logs)" });

    const cmdDisplayName = interaction && subCommand ? `${commandName} -> ${subCommand}` : commandName;

    try {
        const errorChannelId = process.env.ERROR_CHANNEL_ID;
        if (!errorChannelId) throw new Error("ERROR_CHANNEL_ID is not configured");

        await client.rest.createMessage(errorChannelId, {
            content: process.env.OWNER_ID ? `<@${process.env.OWNER_ID}> command error logged` : "Command error logged",
            embeds: [
                {
                    type: EmbedType.Rich,
                    title: `Runtime error on command${interaction ? " (slash)" : ""}: ${cmdDisplayName}`,
                    fields,
                },
            ],
        });
    } catch (logChannelError) {
        logger.error("Failed to send error to log channel", logChannelError as Error);
    }

    const logPrefix = `[${guildName}] ${user.username} had an error in ${interaction ? "slash" : "prefix"} command \`${cmdDisplayName}\``;
    await logger.error(logPrefix, error, {
        guildId,
        guildName,
        userId: user.id,
        username: user.username,
        command: commandName,
        subCommand,
        prefix,
    });
}
