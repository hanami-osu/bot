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

        if (interaction.isApplicationCommandInteraction()) {
            const command = commandsCache.get(interaction.data.name);
            if (!command) return;

            const ctx = new CommandContext(interaction.client, interaction, undefined, [], undefined, command.data.name);
            const { user } = ctx;

            try {
                if (command.run) {
                    await command.run(ctx);
                } else if (command.runApplication && interaction.inGuild()) {
                    await command.runApplication({ interaction });
                } else {
                    await ctx.respondUnavailable(command.data.availability?.unavailableMessage ?? "This command is not available in this context.");
                    return; // Command has no valid execution function
                }

                try {
                    let guildName = "Direct Message";
                    if (ctx.guildId) {
                        const guild = await interaction.client.rest.getGuild(ctx.guildId);
                        guildName = guild.name;
                    }

                    await logger.info(`[${guildName}] ${user.username} used slash command \`${command.data.name}\`${interaction.data.subCommand ? ` -> \`${interaction.data.subCommand}\`` : ""}`, {
                        guildId: ctx.guildId,
                        guildName,
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

    const builderOptions = await ButtonStateCache.get(interaction.message.id);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({ ephemeral: true, content: "This button will not work because the message was created before a bot restart, so its data has been lost." });
        return;
    }

    const user = interaction.inGuild() ? interaction.member.user : interaction.inDM() ? interaction.user : undefined;
    if (!user) return;

    if (builderOptions.initiatorId !== user.id) {
        await interaction.reply({ ephemeral: true, content: "You need to be the person who initialized the command to be able to interact with this." });
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
