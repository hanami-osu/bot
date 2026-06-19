import { describe, expect, test } from "bun:test";
import { ComponentType, TextInputStyle } from "lilybird";
import { createPaginationJumpModalComponents, getModalInputValue } from "../../src/interactions/pagination-handler";
import { PAGINATION_JUMP_INPUT_ID, PaginationType } from "../../src/utils/pagination";

describe("pagination handler helpers", () => {
    test("builds jump modal components with current value", () => {
        expect(createPaginationJumpModalComponents(PaginationType.PAGE, 12, 2)).toEqual([
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        custom_id: PAGINATION_JUMP_INPUT_ID,
                        style: TextInputStyle.Short,
                        label: "Page (1-12)",
                        min_length: 1,
                        max_length: 2,
                        required: true,
                        value: "3",
                        placeholder: "3",
                    },
                ],
            },
        ]);
    });

    test("reads modal input values", () => {
        const components = createPaginationJumpModalComponents(PaginationType.INDEX, 8, 4);

        expect(getModalInputValue(components, PAGINATION_JUMP_INPUT_ID)).toBe("5");
        expect(getModalInputValue(components, "missing")).toBeUndefined();
    });
});
