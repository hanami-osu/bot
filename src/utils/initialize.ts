import { prisma, removeEntry } from "@utils/database";
import { guildPrefixesCache, commandsCache, slashCommandIdsCache, commandAliasesCache } from "@utils/cache";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import { auth } from "osu-api-extended";
import { readdir } from "fs/promises";
import type { CommandFileData } from "@type/commands";
import { Client, ApplicationCommand } from "lilybird";
import { CommandIntegrationType, CommandInteractionContext } from "./command-context";

const DEFAULT_APPLICATION_INTEGRATION_TYPES = [CommandIntegrationType.GuildInstall, CommandIntegrationType.UserInstall];
const DEFAULT_APPLICATION_CONTEXTS = [CommandInteractionContext.Guild, CommandInteractionContext.BotDM, CommandInteractionContext.PrivateChannel];

export async function initializeOsuApi(): Promise<void> {
    await auth.login({
        type: "v2",
        client_id: Number(process.env.OSU_CLIENT_ID),
        client_secret: process.env.OSU_CLIENT_SECRET,
        cachedTokenPath: "./osu-token.json",
        scopes: ["public"],
    });
}

export async function loadCommands(lilyClient: Client): Promise<void> {
    // temp array to store promises
    const commandDataPromises: Array<Promise<CommandFileData>> = [];
    const applicationCommands: Array<ApplicationCommand.Create.ApplicationCommandJSONParams> = [];

    const items = await readdir("./src/commands", { recursive: true });
    for (const item of items) {
        const [category, cmd] = item.split(process.platform === "win32" ? "\\" : "/");
        if (!category || !cmd) continue;

        const command = import(`../commands/${category}/${cmd}`) as Promise<CommandFileData>;
        commandDataPromises.push(command);
    }

    const commands = await Promise.all(commandDataPromises);
    for (const command of commands) {
        const { data } = command;
        commandsCache.set(data.name, command); // this is for message commands, you make a key-value thing for it

        // check for aliases
        const { aliases } = data.message ?? {};
        if (aliases && aliases.length > 0 && Array.isArray(aliases)) {
            for (const alias of aliases) {
                commandAliasesCache.set(alias, data.name); // same thing we did with message commands
            }
        }

        // construct back the application data from `data` and push to array
        // only include commands that have application command support
        if (typeof command.runApplication === "function" || typeof command.run === "function") {
            const applicationData = {
                ...(data.application || {}),
                name: data.name,
                description: data.description,
                integration_types: data.availability?.integrationTypes ?? data.application?.integration_types ?? DEFAULT_APPLICATION_INTEGRATION_TYPES,
                contexts: data.availability?.contexts ?? data.application?.contexts ?? DEFAULT_APPLICATION_CONTEXTS,
            };
            applicationCommands.push(applicationData);
        }
    }

    const noApplication = process.argv.includes("--no-application");

    if (noApplication) {
        logger.info("Skipping application command registration (--no-application flag set).");
        return;
    }

    // overwrite application commands
    if (process.env.DEV === "true") {
        logger.info("Processing commands as Development.");
        try {
            // lilybird's bulkOverwriteGuildApplicationCommand mistakenly uses PATCH instead of PUT, causing a 405 error.
            // We bypass it and make a direct PUT request.
            const guildCommandIds = await lilyClient.rest.makeAPIRequest(
                "PUT",
                `applications/${lilyClient.user.id}/guilds/${process.env.DEV_GUILD_ID}/commands`,
                applicationCommands
            ) as Array<{ name: string; id: string }>;

            for (const commandId of guildCommandIds) {
                const { name, id } = commandId;
                slashCommandIdsCache.set(name, `</${name}:${id}>`);
            }
        } catch (error) {
            logger.error(`Failed to overwrite commands for DEV_GUILD_ID (${process.env.DEV_GUILD_ID}). Make sure it's a valid Server ID, not your User ID!`, error as Error);
        }
    } else {
        logger.info("Processing commands as Production.");
        try {
            const globalCommandIds = await lilyClient.rest.bulkOverwriteGlobalApplicationCommand(lilyClient.user.id, applicationCommands);

            for (const commandId of globalCommandIds) {
                const { name, id } = commandId;
                slashCommandIdsCache.set(name, `</${name}:${id}>`);
            }
        } catch (error) {
            logger.error("Failed to overwrite global commands.", error as Error);
        }
    }

    logger.info(`Loaded ${commandsCache.size} message commands and ${applicationCommands.length} application commands ✅`);
}

export async function refreshGuildsDatabase(): Promise<void> {
    const nulledGuilds = await prisma.guild.findMany({ where: { name: null } });

    if (nulledGuilds.length === 0) return;

    for (const guild of nulledGuilds) {
        logger.info(`Removed guild: ${guild.name} (${guild.id})`);
        await removeEntry(Tables.GUILD, guild.id);
    }
}

export async function initializeDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info("Database up and running!");
    } catch (e) {
        await logger.error("Failed to connect to database", e as Error);
        throw e;
    }
}

export async function loadGuildPrefixes(): Promise<void> {
    try {
        const guilds = await prisma.guild.findMany({
            where: { prefixes: { not: null } },
            select: { id: true, prefixes: true }
        });

        let loadedCount = 0;
        for (const guild of guilds) {
            try {
                if (guild.prefixes) {
                    const prefixes = JSON.parse(guild.prefixes) as Array<string>;
                    guildPrefixesCache.set(guild.id, prefixes);
                    loadedCount++;
                }
            } catch (parseError) {
                logger.error(`Failed to parse prefixes for guild ${guild.id}`, parseError as Error);
            }
        }

        logger.info(`Loaded ${loadedCount}/${guilds.length} guild prefixes into cache`);
    } catch (error) {
        logger.error("Failed to load guild prefixes", error as Error);
    }
}
