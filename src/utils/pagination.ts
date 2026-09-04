import { ButtonStyle, ComponentType } from "lilybird";
import type { Message } from "lilybird";
import { EmbedBuilderType, type EmbedBuilderOptions } from "@type/builders";
import { filterPlays } from "@utils/play-filters";

export const ITEMS_PER_PAGE = 5;
export const PAGINATION_JUMP_INPUT_ID = "pagination-jump-value";

export enum PaginationType {
    PAGE = "page",
    INDEX = "index",
}

export enum PaginationAction {
    FIRST = "first",
    PREV = "prev",
    NEXT = "next",
    LAST = "last",
}

interface PaginationConfig {
    type: PaginationType;
    totalItems: number;
    currentValue: number;
    itemsPerPage?: number;
}

interface PaginationJumpModalData {
    type: PaginationType;
    channelId: string;
    messageId: string;
}

function getButtonConfig(
    type: PaginationType,
    currentValue: number,
    totalValues: number,
): { customIds: Array<string>; labels: Array<string>; styles: Array<ButtonStyle> } {
    const suffix = type === PaginationType.PAGE ? "page" : "index";
    return {
        customIds: [`min-${suffix}`, `decrement-${suffix}`, `wildcard-${suffix}`, `increment-${suffix}`, `max-${suffix}`],
        labels: ["First", "Previous", `${currentValue + 1} / ${totalValues}`, "Next", "Last"],
        styles: [ButtonStyle.Secondary, ButtonStyle.Secondary, ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Secondary],
    };
}

export function createActionRow(config: PaginationConfig): Array<Message.Component.Structure> {
    const { type, totalItems, currentValue, itemsPerPage = ITEMS_PER_PAGE } = config;
    const totalValues = getTotalValues(totalItems, type, itemsPerPage);
    const { customIds, labels, styles } = getButtonConfig(type, currentValue, totalValues);
    const disabledStates = [
        currentValue === 0,
        currentValue === 0,
        totalValues <= 1,
        currentValue >= totalValues - 1,
        currentValue >= totalValues - 1,
    ];

    return [
        {
            type: ComponentType.ActionRow,
            components: customIds.map((customId, index) => ({
                type: ComponentType.Button,
                style: styles[index],
                custom_id: customId,
                label: labels[index],
                disabled: disabledStates[index],
            })),
        },
    ];
}

export function parseButtonAction(buttonId: string): { type: PaginationType; action: PaginationAction } | null {
    const match = /^(min|max|increment|decrement)-(page|index)$/.exec(buttonId);
    if (!match) return null;

    const actionMap: Record<string, PaginationAction> = {
        min: PaginationAction.FIRST,
        decrement: PaginationAction.PREV,
        increment: PaginationAction.NEXT,
        max: PaginationAction.LAST,
    };

    return {
        type: match[2] === "page" ? PaginationType.PAGE : PaginationType.INDEX,
        action: actionMap[match[1]],
    };
}

export function parseJumpButtonType(buttonId: string): PaginationType | null {
    const match = /^wildcard-(page|index)$/.exec(buttonId);
    if (!match) return null;
    return match[1] === "page" ? PaginationType.PAGE : PaginationType.INDEX;
}

export function createJumpModalId(type: PaginationType, channelId: string, messageId: string): string {
    return `pagination-jump:${type}:${channelId}:${messageId}`;
}

export function parseJumpModalId(modalId: string): PaginationJumpModalData | null {
    const match = /^pagination-jump:(page|index):([^:]+):([^:]+)$/.exec(modalId);
    if (!match) return null;

    return {
        type: match[1] === "page" ? PaginationType.PAGE : PaginationType.INDEX,
        channelId: match[2],
        messageId: match[3],
    };
}

export function getTotalValues(totalItems: number, type: PaginationType, itemsPerPage = ITEMS_PER_PAGE): number {
    return type === PaginationType.PAGE ? Math.ceil(totalItems / itemsPerPage) : totalItems;
}

export function calculateNewValue(
    action: PaginationAction,
    currentValue: number,
    totalItems: number,
    type: PaginationType,
    itemsPerPage = ITEMS_PER_PAGE,
): number {
    const maxValue = getTotalValues(totalItems, type, itemsPerPage) - 1;

    switch (action) {
        case PaginationAction.FIRST:
            return 0;
        case PaginationAction.PREV:
            return Math.max(0, currentValue - 1);
        case PaginationAction.NEXT:
            return Math.min(maxValue, currentValue + 1);
        case PaginationAction.LAST:
            return maxValue;
    }
}

export function getTotalItems(options: EmbedBuilderOptions): number {
    switch (options.type) {
        case EmbedBuilderType.LEADERBOARD:
            return options.scores.length;
        case EmbedBuilderType.COMPARE:
        case EmbedBuilderType.PLAYS:
            return filterPlays(options.plays, options).length;
        default:
            return 0;
    }
}

export function updateBuilderOptions(
    options: EmbedBuilderOptions,
    action: PaginationAction,
    type: PaginationType,
): EmbedBuilderOptions {
    const totalItems = getTotalItems(options);

    if (options.type === EmbedBuilderType.PLAYS) {
        if (type === PaginationType.PAGE) {
            return {
                ...options,
                page: calculateNewValue(action, options.page ?? 0, totalItems, type),
                isPage: true,
            };
        }

        return {
            ...options,
            index: calculateNewValue(action, options.index ?? 0, totalItems, type),
            isPage: false,
        };
    }

    if (type === PaginationType.PAGE && (options.type === EmbedBuilderType.LEADERBOARD || options.type === EmbedBuilderType.COMPARE)) {
        return {
            ...options,
            page: calculateNewValue(action, options.page ?? 0, totalItems, type),
        };
    }

    return options;
}

export function updateBuilderOptionsValue(
    options: EmbedBuilderOptions,
    value: number,
    type: PaginationType,
): EmbedBuilderOptions {
    if (options.type === EmbedBuilderType.PLAYS) {
        return type === PaginationType.PAGE
            ? { ...options, page: value, isPage: true }
            : { ...options, index: value, isPage: false };
    }

    if (type === PaginationType.PAGE && (options.type === EmbedBuilderType.LEADERBOARD || options.type === EmbedBuilderType.COMPARE)) {
        return { ...options, page: value };
    }

    return options;
}

export function getCurrentValue(options: EmbedBuilderOptions, type: PaginationType): number {
    if (type === PaginationType.INDEX) {
        return options.type === EmbedBuilderType.PLAYS ? (options.index ?? 0) : 0;
    }

    if (options.type === EmbedBuilderType.LEADERBOARD || options.type === EmbedBuilderType.COMPARE || options.type === EmbedBuilderType.PLAYS) {
        return options.page ?? 0;
    }

    return 0;
}

export function getPaginationType(options: EmbedBuilderOptions): PaginationType {
    if (options.type === EmbedBuilderType.PLAYS) {
        return options.isPage === true ? PaginationType.PAGE : PaginationType.INDEX;
    }
    return PaginationType.PAGE;
}

export function createPaginationActionRow(builderOptions: EmbedBuilderOptions): Array<Message.Component.Structure> {
    const totalItems = getTotalItems(builderOptions);
    const paginationType = getPaginationType(builderOptions);
    const currentValue = getCurrentValue(builderOptions, paginationType);

    return createActionRow({
        type: paginationType,
        totalItems,
        currentValue,
        itemsPerPage: ITEMS_PER_PAGE,
    });
}
