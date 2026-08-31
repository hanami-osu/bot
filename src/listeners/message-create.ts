import { $listener } from "@utils/lilybird-handler";
import { dispatchPrefixCommand } from "commands/dispatch/prefix-dispatcher";
import { logger } from "@utils/logger";

$listener({
    event: "messageCreate",
    handle: async (message) => {
        try {
            await dispatchPrefixCommand(message);
        } catch (error) {
            await logger.error("Message listener failed", error as Error);
        }
    },
});
