import { describe, expect, test } from "bun:test";
import { ButtonStyle } from "lilybird";
import {
    calculateNewValue,
    createActionRow,
    createJumpModalId,
    getTotalItems,
    parseButtonAction,
    parseJumpButtonType,
    parseJumpModalId,
    PaginationAction,
    PaginationType,
    updateBuilderOptions,
    updateBuilderOptionsValue,
} from "../../src/utils/pagination";

describe("pagination", () => {
    describe("parseButtonAction", () => {
        test("correctly parses page buttons", () => {
            expect(parseButtonAction("min-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.FIRST });
            expect(parseButtonAction("decrement-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.PREV });
            expect(parseButtonAction("increment-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.NEXT });
            expect(parseButtonAction("max-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.LAST });
        });

        test("correctly parses index buttons", () => {
            expect(parseButtonAction("min-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.FIRST });
            expect(parseButtonAction("decrement-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.PREV });
            expect(parseButtonAction("increment-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.NEXT });
            expect(parseButtonAction("max-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.LAST });
        });

        test("returns null for invalid button ids", () => {
            expect(parseButtonAction("invalid")).toBeNull();
            expect(parseButtonAction("min-unknown")).toBeNull();
            expect(parseButtonAction("wildcard-page")).toBeNull();
        });
    });

    describe("parseJumpButtonType", () => {
        test("correctly parses jump buttons", () => {
            expect(parseJumpButtonType("wildcard-page")).toBe(PaginationType.PAGE);
            expect(parseJumpButtonType("wildcard-index")).toBe(PaginationType.INDEX);
        });

        test("returns null for non-jump buttons", () => {
            expect(parseJumpButtonType("increment-page")).toBeNull();
            expect(parseJumpButtonType("invalid")).toBeNull();
        });
    });

    describe("jump modal ids", () => {
        test("round-trips modal data", () => {
            const modalId = createJumpModalId(PaginationType.PAGE, "123", "456");
            expect(parseJumpModalId(modalId)).toEqual({
                type: PaginationType.PAGE,
                channelId: "123",
                messageId: "456",
            });
        });

        test("returns null for invalid modal ids", () => {
            expect(parseJumpModalId("pagination-jump:unknown:123:456")).toBeNull();
            expect(parseJumpModalId("invalid")).toBeNull();
        });
    });

    describe("calculateNewValue", () => {
        const totalItems = 20;

        test("calculates FIRST action", () => {
            expect(calculateNewValue(PaginationAction.FIRST, 2, totalItems, PaginationType.PAGE)).toBe(0);
        });

        test("calculates PREV action", () => {
            expect(calculateNewValue(PaginationAction.PREV, 2, totalItems, PaginationType.PAGE)).toBe(1);
            expect(calculateNewValue(PaginationAction.PREV, 0, totalItems, PaginationType.PAGE)).toBe(0);
        });

        test("calculates NEXT action for PAGE", () => {
            expect(calculateNewValue(PaginationAction.NEXT, 2, totalItems, PaginationType.PAGE)).toBe(3);
            expect(calculateNewValue(PaginationAction.NEXT, 3, totalItems, PaginationType.PAGE)).toBe(3);
        });

        test("calculates NEXT action for INDEX", () => {
            expect(calculateNewValue(PaginationAction.NEXT, 18, totalItems, PaginationType.INDEX)).toBe(19);
            expect(calculateNewValue(PaginationAction.NEXT, 19, totalItems, PaginationType.INDEX)).toBe(19);
        });

        test("calculates LAST action for PAGE", () => {
            expect(calculateNewValue(PaginationAction.LAST, 0, totalItems, PaginationType.PAGE)).toBe(3);
        });
    });

    describe("updateBuilderOptions", () => {
        test("updates options for PAGE type", () => {
            const options: any = { type: "playBuilder", plays: new Array(20), page: 1, isPage: true };
            const updated = updateBuilderOptions(options, PaginationAction.NEXT, PaginationType.PAGE);

            expect((updated as any).page).toBe(2);
            expect((updated as any).isPage).toBe(true);
        });

        test("updates options for INDEX type", () => {
            const options: any = { type: "playBuilder", plays: new Array(20), index: 5, isPage: false };
            const updated = updateBuilderOptions(options, PaginationAction.PREV, PaginationType.INDEX);

            expect((updated as any).index).toBe(4);
            expect((updated as any).isPage).toBe(false);
        });

        test("updates options to an exact PAGE value", () => {
            const options: any = { type: "playBuilder", plays: new Array(20), page: 0, isPage: true };
            const updated = updateBuilderOptionsValue(options, 3, PaginationType.PAGE);

            expect((updated as any).page).toBe(3);
            expect((updated as any).isPage).toBe(true);
        });

        test("updates options to an exact INDEX value", () => {
            const options: any = { type: "playBuilder", plays: new Array(20), index: 0, isPage: false };
            const updated = updateBuilderOptionsValue(options, 12, PaginationType.INDEX);

            expect((updated as any).index).toBe(12);
            expect((updated as any).isPage).toBe(false);
        });
    });

    describe("getTotalItems", () => {
        test("gets total items from scores", () => {
            const options: any = { type: "leaderboardBuilder", scores: [1, 2, 3] };
            expect(getTotalItems(options)).toBe(3);
        });

        test("gets total items from plays", () => {
            const options: any = { type: "playBuilder", plays: [1, 2] };
            expect(getTotalItems(options)).toBe(2);
        });

        test("returns 0 for builders without pagination data", () => {
            const options: any = { type: "profileBuilder" };
            expect(getTotalItems(options)).toBe(0);
        });
    });

    describe("createActionRow", () => {
        test("disables min and prev buttons on first page", () => {
            const row = createActionRow({ type: PaginationType.PAGE, totalItems: 20, currentValue: 0 });
            const components = (row[0] as any).components;
            expect(components[0].disabled).toBe(true);
            expect(components[1].disabled).toBe(true);
            expect(components[2].disabled).toBe(false);
            expect(components[3].disabled).toBe(false);
            expect(components[4].disabled).toBe(false);
        });

        test("disables next and max buttons on last page", () => {
            const row = createActionRow({ type: PaginationType.PAGE, totalItems: 20, currentValue: 3 });
            const components = (row[0] as any).components;
            expect(components[0].disabled).toBe(false);
            expect(components[1].disabled).toBe(false);
            expect(components[2].disabled).toBe(false);
            expect(components[3].disabled).toBe(true);
            expect(components[4].disabled).toBe(true);
        });

        test("disables the jump button when only one page is available", () => {
            const row = createActionRow({ type: PaginationType.PAGE, totalItems: 3, currentValue: 0 });
            const components = (row[0] as any).components;
            expect(components[2].disabled).toBe(true);
        });

        test("labels controls with their actions and current page", () => {
            const row = createActionRow({ type: PaginationType.PAGE, totalItems: 20, currentValue: 1 });
            const components = (row[0] as any).components;

            expect(components.map((component: any) => component.label)).toEqual(["First", "Previous", "2 / 4", "Next", "Last"]);
            expect(components[2].custom_id).toBe("wildcard-page");
        });

        test("uses a primary jump control and secondary navigation controls", () => {
            const row = createActionRow({ type: PaginationType.INDEX, totalItems: 8, currentValue: 4 });
            const components = (row[0] as any).components;

            expect(components.map((component: any) => component.style)).toEqual([
                ButtonStyle.Secondary,
                ButtonStyle.Secondary,
                ButtonStyle.Primary,
                ButtonStyle.Secondary,
                ButtonStyle.Secondary,
            ]);
            expect(components[2].label).toBe("5 / 8");
        });
    });
});
