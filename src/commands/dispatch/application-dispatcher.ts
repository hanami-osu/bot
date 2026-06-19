import type { Interaction } from "@lilybird/transformers";
import { CommandContext } from "@utils/command-context";
import { incrementCommandCount } from "@utils/database";
import { handleCommandError } from "@utils/error";
import { logger } from "@utils/logger";
import { commandsCache } from "../../state/command-registry";

export async function dispatchApplicationCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isApplicationCommandInteraction()) return;

    const command = commandsCache.get(interaction.data.name);
    if (!command) return;

    const ctx = new CommandContext(interaction.client, interaction, undefined, [], undefined, command.data.name);
    const { user } = ctx;

    try {
        if (command.run) {
            await command.run(ctx);
        } else if (command.runApplication && interaction.inGuild()) {
            await command.runApplication({ interaction });
        } else {
            await ctx.respondUnavailable(command.data.availability?.unavailableMessage ?? "This command is not available in this context.");
            return;
        }

        try {
            await incrementCommandCount(`${command.data.name}:slash`);
        } catch (counterError) {
            await logger.warn("Could not increment slash command counter", { command: command.data.name, error: counterError });
        }

        try {
            let guildName = "Direct Message";
            if (ctx.guildId) {
                const guild = await interaction.client.rest.getGuild(ctx.guildId);
                guildName = guild.name;
            }

            await logger.info(`[${guildName}] ${user.username} used slash command \`${command.data.name}\`${interaction.data.subCommand ? ` -> \`${interaction.data.subCommand}\`` : ""}`, {
                guildId: ctx.guildId,
                guildName,
                userId: user.id,
                username: user.username,
                command: command.data.name,
                subCommand: interaction.data.subCommand,
            });
        } catch (logError) {
            await logger.warn("Could not write slash command usage log", { command: command.data.name, userId: user.id, error: logError });
        }
    } catch (error) {
        await handleCommandError(error as Error, {
            client: interaction.client,
            commandContext: ctx,
            interaction,
            commandName: command.data.name,
            subCommand: interaction.data.subCommand,
        });
    }
}
