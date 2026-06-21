import { compareBuilder, leaderboardBuilder } from "@builders";
import { buildPlayPaginationMessageOptions } from "@services/play-service";
import { ComponentType, TextInputStyle } from "lilybird";
import type { Message } from "lilybird";
import type { Interaction, InteractionReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import type { CompareBuilderOptions, EmbedBuilderOptions, LeaderboardBuilderOptions, PlayPaginationOptions } from "@type/builders";
import { createPaginationActionRow, PAGINATION_JUMP_INPUT_ID, PaginationManager, PaginationType } from "@utils/pagination";
import { ButtonStateCache } from "../state/button-state-cache";

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

    await interaction.updateComponents({ components: disablePaginationComponents(createPaginationActionRow(builderOptions)) });

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

async function handlePaginationModal(interaction: Interaction): Promise<boolean> {
    if (!interaction.isModalSubmitInteraction()) return false;

    const modalData = PaginationManager.parseJumpModalId(interaction.data.id);
    if (!modalData) return false;

    const rawValue = getModalInputValue(interaction.data.components, PAGINATION_JUMP_INPUT_ID);
    const requestedValue = rawValue ? Number(rawValue.trim()) : Number.NaN;

    const builderOptions = await ButtonStateCache.get(modalData.messageId);
    if (builderOptions === null || builderOptions === undefined) {
        await interaction.reply({ ephemeral: true, content: "This page picker will not work because the message was created before a bot restart, so its data has been lost." });
        return true;
    }

    const user = interaction.inGuild() ? interaction.member.user : interaction.inDM() ? interaction.user : undefined;
    if (!user) return true;

    if (builderOptions.initiatorId !== user.id) {
        await interaction.reply({ ephemeral: true, content: "You need to be the person who initialized the command to be able to interact with this." });
        return true;
    }

    const totalValues = PaginationManager.getTotalValues(PaginationManager.getTotalItems(builderOptions), modalData.type);

    if (!Number.isInteger(requestedValue) || requestedValue < 1 || requestedValue > totalValues) {
        await interaction.reply({ ephemeral: true, content: `Please enter a whole number between 1 and ${totalValues}.` });
        return true;
    }

    const updatedOptions = PaginationManager.updateBuilderOptionsValue(builderOptions, requestedValue - 1, modalData.type);
    await ButtonStateCache.set(modalData.messageId, updatedOptions);

    const options = await buildPaginationMessageOptions(updatedOptions);
    if (!options) {
        await interaction.reply({ ephemeral: true, content: "Unsupported builder type for pagination." });
        return true;
    }

    await interaction.updateComponents(options);
    return true;
}

function disablePaginationComponents(components: Array<Message.Component.Structure>): Array<Message.Component.Structure> {
    return components.map((row) => {
        if (row.type !== ComponentType.ActionRow) return row;

        return {
            ...row,
            components: row.components.map((component) => (component.type === ComponentType.Button ? { ...component, disabled: true } : component)),
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
