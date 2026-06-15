import { expect, test, describe } from "bun:test";
import { PaginationManager, PaginationType, PaginationAction } from "../../src/utils/pagination";

describe("PaginationManager", () => {
    describe("parseButtonAction", () => {
        test("correctly parses page buttons", () => {
            expect(PaginationManager.parseButtonAction("min-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.FIRST });
            expect(PaginationManager.parseButtonAction("decrement-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.PREV });
            expect(PaginationManager.parseButtonAction("increment-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.NEXT });
            expect(PaginationManager.parseButtonAction("max-page")).toEqual({ type: PaginationType.PAGE, action: PaginationAction.LAST });
        });

        test("correctly parses index buttons", () => {
            expect(PaginationManager.parseButtonAction("min-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.FIRST });
            expect(PaginationManager.parseButtonAction("decrement-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.PREV });
            expect(PaginationManager.parseButtonAction("increment-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.NEXT });
            expect(PaginationManager.parseButtonAction("max-index")).toEqual({ type: PaginationType.INDEX, action: PaginationAction.LAST });
        });

        test("returns null for invalid button ids", () => {
            expect(PaginationManager.parseButtonAction("invalid")).toBeNull();
            expect(PaginationManager.parseButtonAction("min-unknown")).toBeNull();
        });
    });

    describe("calculateNewValue", () => {
        const totalItems = 20;

        test("calculates FIRST action", () => {
            expect(PaginationManager.calculateNewValue(PaginationAction.FIRST, 2, totalItems, PaginationType.PAGE)).toBe(0);
        });

        test("calculates PREV action", () => {
            expect(PaginationManager.calculateNewValue(PaginationAction.PREV, 2, totalItems, PaginationType.PAGE)).toBe(1);
            expect(PaginationManager.calculateNewValue(PaginationAction.PREV, 0, totalItems, PaginationType.PAGE)).toBe(0);
        });

        test("calculates NEXT action for PAGE", () => {
            expect(PaginationManager.calculateNewValue(PaginationAction.NEXT, 2, totalItems, PaginationType.PAGE)).toBe(3);
            expect(PaginationManager.calculateNewValue(PaginationAction.NEXT, 3, totalItems, PaginationType.PAGE)).toBe(3);
        });

        test("calculates NEXT action for INDEX", () => {
            expect(PaginationManager.calculateNewValue(PaginationAction.NEXT, 18, totalItems, PaginationType.INDEX)).toBe(19);
            expect(PaginationManager.calculateNewValue(PaginationAction.NEXT, 19, totalItems, PaginationType.INDEX)).toBe(19);
        });

        test("calculates LAST action for PAGE", () => {
            expect(PaginationManager.calculateNewValue(PaginationAction.LAST, 0, totalItems, PaginationType.PAGE)).toBe(3);
        });
    });

    describe("updateBuilderOptions", () => {
        test("updates options for PAGE type", () => {
            const options: any = { plays: new Array(20), page: 1, isPage: true };
            const updated = PaginationManager.updateBuilderOptions(options, PaginationAction.NEXT, PaginationType.PAGE);

            expect((updated as any).page).toBe(2);
            expect((updated as any).isPage).toBe(true);
        });

        test("updates options for INDEX type", () => {
            const options: any = { scores: new Array(20), index: 5, isPage: false };
            const updated = PaginationManager.updateBuilderOptions(options, PaginationAction.PREV, PaginationType.INDEX);

            expect((updated as any).index).toBe(4);
            expect((updated as any).isPage).toBe(false);
        });
    });

    describe("getTotalItems", () => {
        test("gets total items from scores", () => {
            const options: any = { scores: [1, 2, 3] };
            expect(PaginationManager.getTotalItems(options)).toBe(3);
        });

        test("gets total items from plays", () => {
            const options: any = { plays: [1, 2] };
            expect(PaginationManager.getTotalItems(options)).toBe(2);
        });

        test("returns 0 if neither exists", () => {
            const options: any = {};
            expect(PaginationManager.getTotalItems(options)).toBe(0);
        });
    });

    describe("createActionRow", () => {
        test("disables min and prev buttons on first page", () => {
            const config = {
                type: PaginationType.PAGE,
                totalItems: 20,
                currentValue: 0,
            };
            const row = PaginationManager.createActionRow(config);
            const components = (row[0] as any).components;
            expect(components[0].disabled).toBe(true); // min
            expect(components[1].disabled).toBe(true); // prev
            expect(components[2].disabled).toBe(false); // next
            expect(components[3].disabled).toBe(false); // max
        });

        test("disables next and max buttons on last page", () => {
            const config = {
                type: PaginationType.PAGE,
                totalItems: 20,
                currentValue: 3, // Max page for 20 items / 5
            };
            const row = PaginationManager.createActionRow(config);
            const components = (row[0] as any).components;
            expect(components[0].disabled).toBe(false); // min
            expect(components[1].disabled).toBe(false); // prev
            expect(components[2].disabled).toBe(true); // next
            expect(components[3].disabled).toBe(true); // max
        });
    });
});
