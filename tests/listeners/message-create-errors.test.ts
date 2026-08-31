import { describe, expect, mock, test } from "bun:test";

const listenerError = new Error("missing permissions");
const dispatchPrefixCommand = mock(() => Promise.reject(listenerError));
const loggerError = mock(() => Promise.resolve());

mock.module("../../src/commands/dispatch/prefix-dispatcher", () => ({ dispatchPrefixCommand }));
mock.module("../../src/utils/logger", () => ({
    logger: {
        error: loggerError,
    },
}));

const { handler } = await import("../../src/utils/lilybird-handler");
await import("../../src/listeners/message-create");

const listeners = handler.getListenersObject(false) as {
    messageCreate: (message: unknown) => Promise<void>;
};

describe("messageCreate listener errors", () => {
    test("contains prefix dispatcher failures instead of rejecting the gateway listener", async () => {
        const message = { id: "message-1" };

        await expect(listeners.messageCreate(message)).resolves.toBeUndefined();

        expect(dispatchPrefixCommand).toHaveBeenCalledWith(message);
        expect(loggerError).toHaveBeenCalledWith("Message listener failed", listenerError);
    });
});
