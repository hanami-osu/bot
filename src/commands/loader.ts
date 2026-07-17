import { readdir } from "fs/promises";
import type { Client, ApplicationCommand } from "lilybird";
import { CommandInteractionContext, CommandIntegrationType } from "@utils/command-context";
import { logger } from "@utils/logger";
import type { CommandFileData } from "@type/commands";
import { commandsCache, registerCommand, registerSlashCommandId } from "../state/command-registry";

const DEFAULT_APPLICATION_INTEGRATION_TYPES = [CommandIntegrationType.GuildInstall, CommandIntegrationType.UserInstall];
const DEFAULT_APPLICATION_CONTEXTS = [
    CommandInteractionContext.Guild,
    CommandInteractionContext.BotDM,
    CommandInteractionContext.PrivateChannel,
];

type ApplicationCommandPayload = ApplicationCommand.Create.ApplicationCommandJSONParams;

function isCommandFileData(value: unknown): value is CommandFileData {
    return (
        typeof value === "object" &&
        value !== null &&
        "data" in value &&
        typeof value.data === "object" &&
        value.data !== null &&
        "name" in value.data
    );
}

export function buildApplicationCommandPayload(command: CommandFileData): ApplicationCommandPayload | null {
    if (typeof command.runApplication !== "function" && typeof command.run !== "function") return null;

    const { data } = command;
    return {
        ...(data.application || {}),
        name: data.name,
        description: data.description,
        integration_types:
            data.availability?.integrationTypes ?? data.application?.integration_types ?? DEFAULT_APPLICATION_INTEGRATION_TYPES,
        contexts: data.availability?.contexts ?? data.application?.contexts ?? DEFAULT_APPLICATION_CONTEXTS,
    };
}

async function discoverCommandModules(): Promise<Array<CommandFileData>> {
    const commandDataPromises: Array<Promise<CommandFileData | null>> = [];
    const items = await readdir("./src/commands", { recursive: true });

    for (const item of items) {
        const [category, cmd] = item.split(process.platform === "win32" ? "\\" : "/");
        if (!category || !cmd) continue;

        const command = import(`./${category}/${cmd}`).then((module: unknown) => (isCommandFileData(module) ? module : null));
        commandDataPromises.push(command);
    }

    const discoveredCommands = await Promise.all(commandDataPromises);
    return discoveredCommands.filter((command): command is CommandFileData => command !== null);
}

function registerLoadedCommands(commands: Array<CommandFileData>): Array<ApplicationCommandPayload> {
    const applicationCommands: Array<ApplicationCommandPayload> = [];

    for (const command of commands) {
        registerCommand(command);

        const applicationPayload = buildApplicationCommandPayload(command);
        if (applicationPayload) {
            applicationCommands.push(applicationPayload);
        }
    }

    return applicationCommands;
}

async function registerApplicationCommands(lilyClient: Client, applicationCommands: Array<ApplicationCommandPayload>): Promise<void> {
    if (process.env.DEV === "true") {
        logger.info("Processing commands as Development.");
        try {
            // lilybird's bulkOverwriteGuildApplicationCommand mistakenly uses PATCH instead of PUT, causing a 405 error.
            // We bypass it and make a direct PUT request.
            const guildCommandIds = (await lilyClient.rest.makeAPIRequest(
                "PUT",
                `applications/${lilyClient.user.id}/guilds/${process.env.DEV_GUILD_ID}/commands`,
                applicationCommands,
            )) as Array<{
                name: string;
                id: string;
            }>;

            for (const commandId of guildCommandIds) {
                registerSlashCommandId(commandId.name, commandId.id);
            }
        } catch (error) {
            logger.error(
                `Failed to overwrite commands for DEV_GUILD_ID (${process.env.DEV_GUILD_ID}). Make sure it's a valid Server ID, not your User ID!`,
                error as Error,
            );
        }
        return;
    }

    logger.info("Processing commands as Production.");
    try {
        const globalCommandIds = await lilyClient.rest.bulkOverwriteGlobalApplicationCommand(lilyClient.user.id, applicationCommands);

        for (const commandId of globalCommandIds) {
            registerSlashCommandId(commandId.name, commandId.id);
        }
    } catch (error) {
        logger.error("Failed to overwrite global commands.", error as Error);
    }
}

export async function loadCommands(lilyClient: Client): Promise<void> {
    const commands = await discoverCommandModules();
    const applicationCommands = registerLoadedCommands(commands);

    const noApplication = process.argv.includes("--no-application");
    if (noApplication) {
        logger.info("Skipping application command registration (--no-application flag set).");
        return;
    }

    await registerApplicationCommands(lilyClient, applicationCommands);
    logger.info(`Loaded ${commandsCache.size} message commands and ${applicationCommands.length} application commands ✅`);
}
