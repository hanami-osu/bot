import db from "@db" with { type: "sqlite" };
import { removeEntry } from "@utils/database";
import { guildPrefixesCache, commandsCache, slashCommandIdsCache, commandAliasesCache } from "@utils/cache";
import { logger } from "@utils/logger";
import { Tables } from "@type/database";
import { auth } from "osu-api-extended";
import { readdir } from "fs/promises";
import type { Guild } from "@type/database";
import type { CommandFileData } from "@type/commands";
import { Client, ApplicationCommand } from "lilybird";

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
        if (typeof command.runApplication === "function") {
            const applicationData = {
                ...(data.application || {}),
                name: data.name,
                description: data.description,
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
        const guildCommandIds = await lilyClient.rest.bulkOverwriteGuildApplicationCommand(lilyClient.user.id, process.env.DEV_GUILD_ID, applicationCommands);

        for (const commandId of guildCommandIds) {
            const { name, id } = commandId;
            slashCommandIdsCache.set(name, `</${name}:${id}>`);
        }
    } else {
        logger.info("Processing commands as Production.");
        const globalCommandIds = await lilyClient.rest.bulkOverwriteGlobalApplicationCommand(lilyClient.user.id, applicationCommands);

        for (const commandId of globalCommandIds) {
            const { name, id } = commandId;
            slashCommandIdsCache.set(name, `</${name}:${id}>`);
        }
    }
}

export function refreshGuildsDatabase(): void {
    const nulledGuilds = db.query("SELECT * FROM guilds WHERE name IS NULL;").all() as Array<Guild>;

    if (nulledGuilds.length === 0) return;

    for (const guild of nulledGuilds) {
        logger.info(`Removed guild: ${guild.name} (${guild.id})`);
        removeEntry(Tables.GUILD, guild.id);
    }
}

interface Columns {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
}

export function initializeDatabase(): void {
    const tables: Array<{ name: string; columns: Array<string> }> = [
        { name: "users", columns: ["id TEXT PRIMARY KEY", "banchoId TEXT", "score_embeds INTEGER", "mode TEXT", "embed_type TEXT", "score_data INTEGER"] },
        { name: "guilds", columns: ["id TEXT PRIMARY KEY", "name TEXT", "owner_id TEXT", "joined_at INTEGER", "prefixes TEXT"] },
        { name: "maps", columns: ["id TEXT PRIMARY KEY", "data TEXT"] },
        { name: "commands", columns: ["id TEXT PRIMARY KEY", "count INTEGER"] },
        {
            name: "osu_scores",
            columns: [
                "id INTEGER PRIMARY KEY",
                "user_id INTEGER",
                "map_id INTEGER",
                "gamemode INTEGER",
                "mods TEXT",
                "score INTEGER",
                "accuracy INTEGER",
                "max_combo INTEGER",
                "grade TEXT",
                "count_50 INTEGER",
                "count_100 INTEGER",
                "count_300 INTEGER",
                "count_miss INTEGER",
                "count_geki INTEGER",
                "count_katu INTEGER",
                "map_state TEXT",
                "ended_at TEXT",
            ],
        },
        {
            name: "osu_scores_pp",
            columns: ["id INTEGER PRIMARY KEY", "pp INTEGER", "pp_fc INTEGER", "pp_perfect INTEGER"],
        },
    ];

    for (const table of tables) {
        const { columns } = table;

        // Create the Databases if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS ${table.name} (${columns.join(", ")});`);

        //  Get all of the existing databases
        const existingColumns = db.prepare(`PRAGMA table_info(${table.name});`).all() as Array<Columns>;

        // Loop through Columns and add/remove them
        for (const columnNameType of columns) {
            const [columnName] = columnNameType.split(" ");

            const columnExists = existingColumns.some((col) => col.name === columnName);

            if (!columnExists) {
                db.run(`ALTER TABLE ${table.name} ADD COLUMN ${columnNameType};`);
                logger.info(`Added column ${columnName} in ${table.name} table`);
            }
        }

        for (const column of existingColumns) {
            const columnName = column.name;
            const columnNotInTables = !columns.some((colType) => colType.startsWith(columnName));

            if (columnNotInTables) {
                db.run(`ALTER TABLE ${table.name} DROP COLUMN ${columnName};`);
                logger.info(`Removed column ${columnName} from ${table.name}`);
            }
        }
    }

    logger.info("Database up and running!");
}

export async function loadGuildPrefixes(): Promise<void> {
    try {
        const guilds = db.prepare("SELECT id, prefixes FROM guilds WHERE prefixes IS NOT NULL").all() as Array<{ id: string; prefixes: string }>;

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
