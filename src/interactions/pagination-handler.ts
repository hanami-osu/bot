import { compareBuilder, leaderboardBuilder } from "@builders";
import { buildPlayPaginationMessageOptions } from "@services/play-service";
import { ComponentType, TextInputStyle } from "lilybird";
import type { Message } from "lilybird";
import type { Interaction, InteractionReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import type { CompareBuilderOptions, EmbedBuilderOptions, LeaderboardBuilderOptions, PlayPaginationOptions } from "@type/builders";
import {
    createJumpModalId,
    createPaginationActionRow,
    getCurrentValue,
    getTotalItems,
    getTotalValues,
    PAGINATION_JUMP_INPUT_ID,
    parseButtonAction,
    parseJumpButtonType,
    parseJumpModalId,
    PaginationType,
    updateBuilderOptions,
    updateBuilderOptionsValue,
} from "@utils/pagination";
import { ButtonStateCache } from "@state/button-state-cache";
import { applyDefaultEmbedColor, simpleErrorEmbed, simpleInfoEmbed, simpleWarningEmbed } from "../embed-builders/common";

type PaginationMessageOptions = Pick<InteractionReplyOptions, "embeds" | "components">;

export async function handlePaginationInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.isMessageComponentInteraction() && interaction.data.isButton()) {
        await handleButton(interaction);
        return true;
    }

    return handlePaginationModal(interaction);
}

async function handleButton(interaction: Interaction): Promise<void> {
    if (!interaction.isMessageComponentInteraction() || !interaction.data.isButton()) return;

    const builderOptions = await ButtonStateCache.get(interaction.message.id);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleWarningEmbed("Run the command again to get fresh controls.", "Controls expired")],
        });
        return;
    }

    const user = interaction.inGuild() ? interaction.member.user : interaction.inDM() ? interaction.user : undefined;
    if (!user) return;

    if (builderOptions.initiatorId !== user.id) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleWarningEmbed("Run the command yourself to get controls you can use.", "Not your controls")],
        });
        return;
    }

    const jumpType = parseJumpButtonType(interaction.data.id);
    if (jumpType) {
        const totalValues = getTotalValues(getTotalItems(builderOptions), jumpType);
        if (totalValues <= 1) {
            await interaction.reply({
                ephemeral: true,
                embeds: [simpleInfoEmbed("There is only one page available.", "Already there")],
            });
            return;
        }

        await interaction.showModal({
            id: createJumpModalId(jumpType, interaction.message.channelId, interaction.message.id),
            title: jumpType === "page" ? "Jump to page" : "Jump to entry",
            components: createPaginationJumpModalComponents(jumpType, totalValues, getCurrentValue(builderOptions, jumpType)),
        });
        return;
    }

    await interaction.updateComponents({ components: disablePaginationComponents(createPaginationActionRow(builderOptions)) });

    const buttonAction = parseButtonAction(interaction.data.id);
    if (!buttonAction) {
        await interaction.editReply({
            embeds: [simpleErrorEmbed("Run the command again to get fresh controls.")],
        });
        return;
    }

    const updatedOptions = updateBuilderOptions(builderOptions, buttonAction.action, buttonAction.type);

    await ButtonStateCache.set(interaction.message.id, updatedOptions);

    const options = await buildPaginationMessageOptions(updatedOptions);

    if (!options) {
        await interaction.editReply({
            embeds: [simpleErrorEmbed("Run the command again to get fresh controls.")],
        });
        return;
    }

    await interaction.editReply(applyDefaultEmbedColor(options));
}

async function handlePaginationModal(interaction: Interaction): Promise<boolean> {
    if (!interaction.isModalSubmitInteraction()) return false;

    const modalData = parseJumpModalId(interaction.data.id);
    if (!modalData) return false;

    const rawValue = getModalInputValue(interaction.data.components, PAGINATION_JUMP_INPUT_ID);
    const requestedValue = rawValue ? Number(rawValue.trim()) : Number.NaN;

    const builderOptions = await ButtonStateCache.get(modalData.messageId);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleWarningEmbed("Run the command again to get a fresh page picker.", "Page picker expired")],
        });
        return true;
    }

    const user = interaction.inGuild() ? interaction.member.user : interaction.inDM() ? interaction.user : undefined;
    if (!user) return true;

    if (builderOptions.initiatorId !== user.id) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleWarningEmbed("Run the command yourself to get controls you can use.", "Not your controls")],
        });
        return true;
    }

    const totalValues = getTotalValues(getTotalItems(builderOptions), modalData.type);

    if (!Number.isInteger(requestedValue) || requestedValue < 1 || requestedValue > totalValues) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleErrorEmbed(`Please enter a whole number between 1 and ${totalValues}.`, "Check your input")],
        });
        return true;
    }

    const updatedOptions = updateBuilderOptionsValue(builderOptions, requestedValue - 1, modalData.type);
    await ButtonStateCache.set(modalData.messageId, updatedOptions);

    const options = await buildPaginationMessageOptions(updatedOptions);
    if (!options) {
        await interaction.reply({
            ephemeral: true,
            embeds: [simpleErrorEmbed("Run the command again to get fresh controls.")],
        });
        return true;
    }

    await interaction.updateComponents(applyDefaultEmbedColor(options));
    return true;
}

function disablePaginationComponents(components: Array<Message.Component.Structure>): Array<Message.Component.Structure> {
    return components.map((row) => {
        if (row.type !== ComponentType.ActionRow) return row;

        return {
            ...row,
            components: row.components.map(component => (component.type === ComponentType.Button ? { ...component, disabled: true } : component)),
        };
    });
}

export function createPaginationJumpModalComponents(type: PaginationType, totalValues: number, currentValue: number): Array<Message.Component.ActionRowStructure> {
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

export function getModalInputValue(components: Array<Message.Component.Structure>, inputId: string): string | undefined {
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
            options.embeds = await leaderboardBuilder(updatedOptions as LeaderboardBuilderOptions);
            break;
        case EmbedBuilderType.PLAYS:
            return await buildPlayPaginationMessageOptions(updatedOptions as PlayPaginationOptions);
        case EmbedBuilderType.COMPARE:
            options.embeds = await compareBuilder(updatedOptions as CompareBuilderOptions);
            break;
        default:
            return null;
    }

    options.components = createPaginationActionRow(updatedOptions);
    return options;
}
