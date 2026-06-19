import { $listener } from "@utils/lilybird-handler";
import { dispatchPrefixCommand } from "commands/dispatch/prefix-dispatcher";

$listener({
    event: "messageCreate",
    handle: async (message) => {
        await dispatchPrefixCommand(message);
    },
});
