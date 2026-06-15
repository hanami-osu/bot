import { incrementCommandCount } from "@utils/database";
import { commandsCache } from "@utils/cache";
import { logger } from "@utils/logger";
import { ButtonStateCache } from "@utils/cache";
import { EmbedBuilderType } from "@type/builders";
import { createPaginationActionRow } from "@utils/pagination";
import { PaginationManager } from "@utils/pagination";
import { leaderboardBuilder, playBuilder, compareBuilder } from "@builders";
import type { Interaction, InteractionReplyOptions } from "@lilybird/transformers";
import { handleCommandError } from "@utils/error";
import { CommandContext } from "@utils/command-context";
import { $listener } from "@utils/lilybird-handler";

$listener({
    event: "interactionCreate",
    handle: async (interaction) => {
        await handleButton(interaction);

        if (interaction.isApplicationCommandInteraction() && interaction.inGuild()) {
            const { user } = interaction.member;

            const command = commandsCache.get(interaction.data.name);
            if (!command) return;

            try {
                if (command.run) {
                    const ctx = new CommandContext(interaction.client, interaction, undefined, [], undefined, command.data.name);
                    await command.run(ctx);
                } else if (command.runApplication) {
                    await command.runApplication({ interaction });
                } else {
                    return; // Command has no valid execution function
                }

                try {
                    const guild = await interaction.client.rest.getGuild(interaction.guildId);
                    await logger.info(`[${guild.name}] ${user.username} used slash command \`${command.data.name}\`${interaction.data.subCommand ? ` -> \`${interaction.data.subCommand}\`` : ""}`, {
                        guildId: interaction.guildId,
                        guildName: guild.name,
                        userId: user.id,
                        username: user.username,
                        command: command.data.name,
                        subCommand: interaction.data.subCommand,
                    });
                } catch (logError) {
                    await logger.warn("Could not write slash command usage log", { command: command.data.name, userId: user.id, error: logError });
                }
            } catch (error) {
                await handleCommandError(error as Error, {
                    client: interaction.client,
                    interaction,
                    commandName: command.data.name,
                    subCommand: interaction.data.subCommand,
                });
            } finally {
                try {
                    await incrementCommandCount(`${command.data.name}:slash`);
                } catch (counterError) {
                    await logger.warn("Could not increment slash command counter", { command: command.data.name, error: counterError });
                }
            }
        }
    },
});

async function handleButton(interaction: Interaction): Promise<void> {
    if (!interaction.isMessageComponentInteraction() || !interaction.data.isButton()) return;
    if (!interaction.inGuild()) return;

    const builderOptions = await ButtonStateCache.get(interaction.message.id);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({ ephemeral: true, content: "This button will not work because the message was created before a bot restart, so its data has been lost." });
        return;
    }

    if (builderOptions.initiatorId !== interaction.member.user.id) {
        await interaction.reply({ ephemeral: true, content: "You need to be the person who initialized the command to be able to click the buttons." });
        return;
    }

    // Temporarily disable all buttons during processing
    const currentComponents = createPaginationActionRow(builderOptions);
    const disabledComponents = currentComponents.map((row: any) => ({
        ...row,
        components: row.components.map((btn: any) => ({ ...btn, disabled: true })),
    }));

    await interaction.updateComponents({ components: disabledComponents });

    if (interaction.data.id === "wildcard-page" || interaction.data.id === "wildcard-index") {
        await interaction.editReply({ content: "This feature has not been implemented yet." });
        return;
    }

    const buttonAction = PaginationManager.parseButtonAction(interaction.data.id);
    if (!buttonAction) {
        await interaction.editReply({ content: "Unknown button action." });
        return;
    }

    const updatedOptions = PaginationManager.updateBuilderOptions(builderOptions, buttonAction.action, buttonAction.type);

    await ButtonStateCache.set(interaction.message.id, updatedOptions);

    const options: InteractionReplyOptions = {};

    // Build the appropriate embed
    switch (updatedOptions.type) {
        case EmbedBuilderType.LEADERBOARD:
            options.embeds = await leaderboardBuilder(updatedOptions as any);
            break;
        case EmbedBuilderType.PLAYS:
            options.embeds = await playBuilder(updatedOptions as any);
            break;
        case EmbedBuilderType.COMPARE:
            options.embeds = await compareBuilder(updatedOptions as any);
            break;
        default:
            await interaction.reply({ ephemeral: true, content: "Unsupported builder type for pagination." });
            return;
    }

    // Create the action row with proper disabled states
    options.components = createPaginationActionRow(updatedOptions);

    await interaction.editReply(options);
}
