import { incrementCommandCount } from "@utils/database";
import { commandsCache } from "@utils/cache";
import { logger } from "@utils/logger";
import { ButtonStateCache } from "@utils/cache";
import { EmbedBuilderType } from "@type/builders";
import { createPaginationActionRow, PAGINATION_JUMP_INPUT_ID } from "@utils/pagination";
import { PaginationManager } from "@utils/pagination";
import { leaderboardBuilder, playBuilder, compareBuilder } from "@builders";
import type { Interaction, InteractionReplyOptions } from "@lilybird/transformers";
import { handleCommandError } from "@utils/error";
import { CommandContext } from "@utils/command-context";
import { $listener } from "@utils/lilybird-handler";
import { ComponentType, TextInputStyle } from "lilybird";
import type { Message } from "lilybird";
import type { EmbedBuilderOptions } from "@type/builders";

type PaginationMessageOptions = Pick<InteractionReplyOptions, "embeds" | "components">;

$listener({
    event: "interactionCreate",
    handle: async (interaction) => {
        await handleButton(interaction);
        await handlePaginationModal(interaction);

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

                // update slash command counter only after the command successfully runs.
                try {
                    await incrementCommandCount(`${command.data.name}:slash`);
                } catch (counterError) {
                    await logger.warn("Could not increment slash command counter", { command: command.data.name, error: counterError });
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
                    commandContext: ctx,
                    interaction,
                    commandName: command.data.name,
                    subCommand: interaction.data.subCommand,
                });
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

    const jumpType = PaginationManager.parseJumpButtonType(interaction.data.id);
    if (jumpType) {
        const totalValues = PaginationManager.getTotalValues(PaginationManager.getTotalItems(builderOptions), jumpType);
        if (totalValues <= 1) {
            await interaction.reply({ ephemeral: true, content: "There is only one page available." });
            return;
        }

        await interaction.showModal({
            id: PaginationManager.createJumpModalId(jumpType, interaction.message.channelId, interaction.message.id),
            title: jumpType === "page" ? "Jump to page" : "Jump to entry",
            components: createPaginationJumpModalComponents(jumpType, totalValues, PaginationManager.getCurrentValue(builderOptions, jumpType)),
        });
        return;
    }

    // Temporarily disable all buttons during processing
    const currentComponents = createPaginationActionRow(builderOptions);
    const disabledComponents = currentComponents.map((row: any) => ({
        ...row,
        components: row.components.map((btn: any) => ({ ...btn, disabled: true })),
    }));

    await interaction.updateComponents({ components: disabledComponents });

    const buttonAction = PaginationManager.parseButtonAction(interaction.data.id);
    if (!buttonAction) {
        await interaction.editReply({ content: "Unknown button action." });
        return;
    }

    const updatedOptions = PaginationManager.updateBuilderOptions(builderOptions, buttonAction.action, buttonAction.type);

    await ButtonStateCache.set(interaction.message.id, updatedOptions);

    const options = await buildPaginationMessageOptions(updatedOptions);

    if (!options) {
        await interaction.editReply({ content: "Unsupported builder type for pagination." });
        return;
    }

    await interaction.editReply(options);
}

async function handlePaginationModal(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmitInteraction()) return;

    const modalData = PaginationManager.parseJumpModalId(interaction.data.id);
    if (!modalData) return;

    const rawValue = getModalInputValue(interaction.data.components, PAGINATION_JUMP_INPUT_ID);
    const requestedValue = rawValue ? Number(rawValue.trim()) : Number.NaN;

    const builderOptions = await ButtonStateCache.get(modalData.messageId);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({ ephemeral: true, content: "This page picker will not work because the message was created before a bot restart, so its data has been lost." });
        return;
    }

    const user = interaction.inGuild() ? interaction.member.user : interaction.inDM() ? interaction.user : undefined;
    if (!user) return;

    if (builderOptions.initiatorId !== user.id) {
        await interaction.reply({ ephemeral: true, content: "You need to be the person who initialized the command to be able to interact with this." });
        return;
    }

    const totalValues = PaginationManager.getTotalValues(PaginationManager.getTotalItems(builderOptions), modalData.type);

    if (!Number.isInteger(requestedValue) || requestedValue < 1 || requestedValue > totalValues) {
        await interaction.reply({ ephemeral: true, content: `Please enter a whole number between 1 and ${totalValues}.` });
        return;
    }

    const updatedOptions = PaginationManager.updateBuilderOptionsValue(builderOptions, requestedValue - 1, modalData.type);
    await ButtonStateCache.set(modalData.messageId, updatedOptions);

    const options = await buildPaginationMessageOptions(updatedOptions);
    if (!options) {
        await interaction.reply({ ephemeral: true, content: "Unsupported builder type for pagination." });
        return;
    }

    await interaction.updateComponents(options);
}

function createPaginationJumpModalComponents(type: "page" | "index", totalValues: number, currentValue: number): Array<Message.Component.ActionRowStructure> {
    const label = type === "page" ? `Page (1-${totalValues})` : `Entry (1-${totalValues})`;

    return [
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: PAGINATION_JUMP_INPUT_ID,
                    style: TextInputStyle.Short,
                    label,
                    min_length: 1,
                    max_length: String(totalValues).length,
                    required: true,
                    value: String(currentValue + 1),
                    placeholder: String(currentValue + 1),
                },
            ],
        },
    ];
}

function getModalInputValue(components: Array<Message.Component.Structure>, inputId: string): string | undefined {
    for (const component of components) {
        if (component.type !== ComponentType.ActionRow) continue;

        for (const nestedComponent of component.components) {
            if (nestedComponent.type === ComponentType.TextInput && nestedComponent.custom_id === inputId) {
                return nestedComponent.value;
            }
        }
    }

    return undefined;
}

async function buildPaginationMessageOptions(updatedOptions: EmbedBuilderOptions): Promise<PaginationMessageOptions | null> {
    const options: PaginationMessageOptions = {};

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
            return null;
    }

    options.components = createPaginationActionRow(updatedOptions);
    return options;
}
