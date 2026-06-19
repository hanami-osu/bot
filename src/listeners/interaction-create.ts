import { dispatchApplicationCommand } from "commands/dispatch/application-dispatcher";
import { handlePaginationInteraction } from "../interactions/pagination-handler";
import { $listener } from "@utils/lilybird-handler";

$listener({
    event: "interactionCreate",
    handle: async (interaction) => {
        if (await handlePaginationInteraction(interaction)) return;
        await dispatchApplicationCommand(interaction);
    },
});
