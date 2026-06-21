import { simpleErrorEmbed } from "@builders";
import type { CommandData } from "@type/commands";
import { CommandInteractionContext, CommandIntegrationType } from "@utils/command-context";
import type { CommandContext } from "@utils/command-context";
import { ApplicationCommandOptionType } from "lilybird";

interface TemplateOptions {
    input?: string;
    ephemeral: boolean;
}

function getDiscordOptions(ctx: CommandContext): TemplateOptions {
    if (ctx.isInteraction) {
        return {
            input: ctx.interaction?.data.getString("input")?.trim() || undefined,
            ephemeral: ctx.interaction?.data.getBoolean("ephemeral") ?? false,
        };
    }

    return {
        input: ctx.args.join(" ").trim() || undefined,
        ephemeral: false,
    };
}

export async function run(ctx: CommandContext): Promise<void> {
    const discordOptions = getDiscordOptions(ctx);

    await ctx.defer(discordOptions.ephemeral);

    // Use this for guild-only commands.
    // if (!(await ctx.ensureGuild("This command can only be used in a server."))) return;

    if (!discordOptions.input) {
        await ctx.editReply({
            embeds: [simpleErrorEmbed("Missing required input.")],
        });
        return;
    }

    await ctx.editReply({
        content: `Received: \`${discordOptions.input}\``,
    });
}

export const data: CommandData = {
    name: "template",
    description: "Short command description.",
    hasPrefixVariant: true,

    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "input",
                description: "Input for the command.",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.BOOLEAN,
                name: "ephemeral",
                description: "Whether the response should only be visible to you.",
                required: false,
            },
        ],
    },

    message: {
        aliases: ["tpl"],
        usage: "<input>",
        details: "Shorter help text for prefix command usage.",
        flags: "--example",
        cooldown: 5,
    },

    // Defaults are guild install + user install, usable in guilds, bot DMs, and private channels.
    // Keep this only when the command needs stricter availability.
    availability: {
        integrationTypes: [CommandIntegrationType.GuildInstall, CommandIntegrationType.UserInstall],
        contexts: [CommandInteractionContext.Guild, CommandInteractionContext.BotDM, CommandInteractionContext.PrivateChannel],
        unavailableMessage: "This command is not available here.",
    },
};
