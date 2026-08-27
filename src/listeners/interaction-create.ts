import { dispatchApplicationCommand } from "commands/dispatch/application-dispatcher";
import { handlePaginationInteraction } from "../interactions/pagination-handler";
import { $listener } from "@utils/lilybird-handler";
import { logger } from "@utils/logger";

$listener({
    event: "interactionCreate",
    handle: async (interaction) => {
        try {
            if (await handlePaginationInteraction(interaction)) return;
            await dispatchApplicationCommand(interaction);
        } catch (error) {
            await logger.error("Interaction listener failed", error as Error);
        }
    },
});
