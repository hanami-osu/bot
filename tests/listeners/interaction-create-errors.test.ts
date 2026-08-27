import { describe, expect, mock, test } from "bun:test";

const paginationError = new Error("redis unavailable");
const handlePaginationInteraction = mock(() => Promise.reject(paginationError));
const dispatchApplicationCommand = mock(() => Promise.resolve());
const loggerError = mock(() => Promise.resolve());

mock.module("../../src/interactions/pagination-handler", () => ({ handlePaginationInteraction }));
mock.module("../../src/commands/dispatch/application-dispatcher", () => ({ dispatchApplicationCommand }));
mock.module("../../src/utils/logger", () => ({
    logger: {
        error: loggerError,
    },
}));

const { handler } = await import("../../src/utils/lilybird-handler");
await import("../../src/listeners/interaction-create");

const listeners = handler.getListenersObject(false) as {
    interactionCreate: (interaction: unknown) => Promise<void>;
};

describe("interactionCreate listener", () => {
    test("contains pagination failures instead of rejecting the gateway listener", async () => {
        const interaction = { id: "interaction-1" };

        await expect(listeners.interactionCreate(interaction)).resolves.toBeUndefined();

        expect(handlePaginationInteraction).toHaveBeenCalledWith(interaction);
        expect(dispatchApplicationCommand).not.toHaveBeenCalled();
        expect(loggerError).toHaveBeenCalledWith("Interaction listener failed", paginationError);
    });
});
