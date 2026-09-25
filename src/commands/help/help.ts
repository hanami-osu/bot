import { CommandData } from "@type/commands";
import { ApplicationCommandOptionType } from "lilybird";
import { helpBuilder } from "@builders";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const commandName = ctx.isInteraction ? ctx.interaction!.data.getString("command") : ctx.args[0];
    const preferSlash = ctx.isInteraction;

    await ctx.editReply({
        embeds: helpBuilder(commandName, preferSlash),
    });
}

export const data = {
    name: "help",
    description: "Get help about the bot or specific commands.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                name: "command",
                description: "Name of the command you want to get information on.",
                type: ApplicationCommandOptionType.STRING,
                required: false,
            },
        ],
    },
} satisfies CommandData;
