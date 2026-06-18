import { ComponentType, ButtonStyle } from "lilybird";
import { filterPlays } from "@utils/play-filters";
import type { Message } from "lilybird";
import type { EmbedBuilderOptions } from "@type/builders";

export const ITEMS_PER_PAGE = 5;

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

export class PaginationManager {
    private static getButtonConfig(type: PaginationType) {
        const suffix = type === PaginationType.PAGE ? "page" : "index";
        return {
            customIds: [`min-${suffix}`, `decrement-${suffix}`, `increment-${suffix}`, `max-${suffix}`],
            labels: ["<<", "<", ">", ">>"],
        };
    }

    static createActionRow(config: PaginationConfig): Array<Message.Component.Structure> {
        const { type, totalItems, currentValue, itemsPerPage = ITEMS_PER_PAGE } = config;
        const { customIds, labels } = this.getButtonConfig(type);

        const totalPages = type === PaginationType.PAGE ? Math.ceil(totalItems / itemsPerPage) : totalItems;

        const disabledStates = [
            currentValue === 0, // First button
            currentValue === 0, // Previous button
            currentValue >= totalPages - 1, // Next button
            currentValue >= totalPages - 1, // Last button
        ];

        const components: Array<Message.Component.Structure> = [];

        for (let i = 0; i < customIds.length; i++) {
            components.push({
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                custom_id: customIds[i],
                label: labels[i],
                disabled: disabledStates[i],
            });
        }

        return [
            {
                type: ComponentType.ActionRow,
                components,
            },
        ];
    }

    static parseButtonAction(buttonId: string): { type: PaginationType; action: PaginationAction } | null {
        const match = buttonId.match(/^(min|max|increment|decrement)-(page|index)$/);
        if (match) {
            const actionMap: Record<string, PaginationAction> = {
                min: PaginationAction.FIRST,
                decrement: PaginationAction.PREV,
                increment: PaginationAction.NEXT,
                max: PaginationAction.LAST,
            };

            const type = match[2] === "page" ? PaginationType.PAGE : PaginationType.INDEX;
            const action = actionMap[match[1]];

            return { type, action };
        }

        return null;
    }

    static calculateNewValue(action: PaginationAction, currentValue: number, totalItems: number, type: PaginationType, itemsPerPage: number = ITEMS_PER_PAGE): number {
        const maxValue = type === PaginationType.PAGE ? Math.ceil(totalItems / itemsPerPage) - 1 : totalItems - 1;

        switch (action) {
            case PaginationAction.FIRST:
                return 0;
            case PaginationAction.PREV:
                return Math.max(0, currentValue - 1);
            case PaginationAction.NEXT:
                return Math.min(maxValue, currentValue + 1);
            case PaginationAction.LAST:
                return maxValue;
            default:
                return currentValue;
        }
    }

    static updateBuilderOptions(options: EmbedBuilderOptions, action: PaginationAction, type: PaginationType): EmbedBuilderOptions {
        // Clone the options to avoid mutations
        const updatedOptions = { ...options } as any;

        let totalItems = 0;
        if ("scores" in updatedOptions && Array.isArray(updatedOptions.scores)) {
            totalItems = updatedOptions.scores.length;
        } else if ("plays" in updatedOptions && Array.isArray(updatedOptions.plays)) {
            totalItems = filterPlays(updatedOptions.plays, updatedOptions).length;
        }

        if (type === PaginationType.PAGE) {
            const currentPage = updatedOptions.page ?? 0;
            const newPage = this.calculateNewValue(action, currentPage, totalItems, type);
            updatedOptions.page = newPage;

            // For plays builder, also update isPage flag
            if ("isPage" in updatedOptions) {
                updatedOptions.isPage = true;
            }
        } else {
            const currentIndex = updatedOptions.index ?? 0;
            const newIndex = this.calculateNewValue(action, currentIndex, totalItems, type);
            updatedOptions.index = newIndex;

            // For plays builder, also update isPage flag
            if ("isPage" in updatedOptions) {
                updatedOptions.isPage = false;
            }
        }

        return updatedOptions as EmbedBuilderOptions;
    }

    static getTotalItems(options: EmbedBuilderOptions): number {
        if ("scores" in options && Array.isArray(options.scores)) {
            return options.scores.length;
        }
        if ("plays" in options && Array.isArray(options.plays)) {
            return filterPlays(options.plays, options).length;
        }
        return 0;
    }

    static getCurrentValue(options: EmbedBuilderOptions, type: PaginationType): number {
        const optionsAny = options as any;
        if (type === PaginationType.PAGE) {
            return optionsAny.page ?? 0;
        }
        return optionsAny.index ?? 0;
    }

    static getPaginationType(options: EmbedBuilderOptions): PaginationType {
        const optionsAny = options as any;
        // For plays builder, check the isPage flag
        if ("isPage" in optionsAny) {
            return optionsAny.isPage === true ? PaginationType.PAGE : PaginationType.INDEX;
        }

        // Default to page for other builders (like leaderboard)
        return PaginationType.PAGE;
    }
}

export function createPaginationActionRow(builderOptions: EmbedBuilderOptions): Array<Message.Component.Structure> {
    const totalItems = PaginationManager.getTotalItems(builderOptions);
    const paginationType = PaginationManager.getPaginationType(builderOptions);
    const currentValue = PaginationManager.getCurrentValue(builderOptions, paginationType);

    return PaginationManager.createActionRow({
        type: paginationType,
        totalItems,
        currentValue,
        itemsPerPage: ITEMS_PER_PAGE,
    });
}
