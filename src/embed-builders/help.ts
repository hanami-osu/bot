import { Tables } from "@type/database";
import { getRowCount, getRowSum } from "@utils/database";
import { commandsCache, commandAliasesCache } from "@utils/cache";
import type { Embed } from "lilybird";

export async function helpBuilder(commandName?: string, preferSlash?: boolean): Promise<Array<Embed.Structure>> {
    if (commandName) {
        return displayCommandInfo(commandName, preferSlash);
    }

    return await displayAllCommands();
}

function displayCommandInfo(name: string, preferSlash?: boolean): Array<Embed.Structure> {
    const command = commandsCache.get(name) ?? commandsCache.get(commandAliasesCache.get(name) ?? "");

    if (!command) {
        return [
            {
                title: "Command Not Found",
                description: `Unfortunately, the command \`${name}\` doesn't exist.`,
                color: 0xff0000,
            },
        ];
    }

    const { data } = command;

    if (preferSlash) {
        return [
            {
                title: `/${data.name}`,
                description: data.description,
                fields: [
                    {
                        name: "Type",
                        value: "Slash Command",
                        inline: true,
                    },
                    {
                        name: "Options",
                        value: data.application?.options?.map((opt) => `\`${opt.name}\` - ${opt.description} ${opt.required ? "(required)" : ""}`).join("\n") ?? "No options",
                        inline: false,
                    },
                ],
            },
        ];
    }

    if (!data.hasPrefixVariant) {
        return [
            {
                title: "No prefix variant",
                description: `This command has no prefix variant, which means you can only use it with slash commands. Try \`/help\``,
                color: 0xff0000,
            },
        ];
    }

    // message commands
    const cooldownSecond = data.message?.cooldown ?? 1000 / 1000;
    return [
        {
            title: `${data.name}`,
            description: data.description,
            fields: [
                {
                    name: "Type",
                    value: "Message Command",
                    inline: true,
                },
                {
                    name: "Cooldown",
                    value: `${cooldownSecond} second${cooldownSecond > 1 ? "s" : ""}`,
                    inline: true,
                },
                {
                    name: "Aliases",
                    value: data.message?.aliases?.join(", ") ?? "No aliases",
                    inline: true,
                },
                {
                    name: "Usage",
                    value: data.message?.usage ?? data.name,
                    inline: false,
                },
                {
                    name: "Details",
                    value: data.message?.details ?? "No additional details",
                },
            ],
        },
    ];
}

async function displayAllCommands(): Promise<Array<Embed.Structure>> {
    const joinedServers = (await getRowCount(Tables.GUILD));
    const linkedUsers = (await getRowCount(Tables.USER));
    const downloadedMaps = (await getRowCount(Tables.MAP));
    const usedCommands = (await getRowSum(Tables.COMMAND));

    const allCommands = Array.from(commandsCache.keys()).sort();

    // Get all command categories
    const slashCommands = allCommands;
    const prefixCommands = allCommands.filter((cmdName) => {
        const cmd = commandsCache.get(cmdName);
        return cmd?.data.hasPrefixVariant === true;
    });

    // Group commands by category
    const slashCategories: Record<string, Array<string>> = {};
    const prefixCategories: Record<string, Array<string>> = {};

    for (const cmdName of slashCommands) {
        const cmd = commandsCache.get(cmdName);
        if (!cmd) continue;

        let category = "General";
        if (
            cmdName.includes("osu") ||
            ["profile", "recent", "top", "compare", "map", "link", "unlink", "avatar", "banner", "background", "simulate", "leaderboard", "recentbest", "recentlist"].includes(cmdName)
        ) {
            category = "osu!";
        } else if (["help", "ping", "invite", "vote", "config", "prefix"].includes(cmdName)) {
            category = "General";
        } else if (cmdName === "owner") {
            category = "Owner";
        }

        if (!slashCategories[category]) slashCategories[category] = [];
        slashCategories[category].push(cmdName);
    }

    for (const cmdName of prefixCommands) {
        const cmd = commandsCache.get(cmdName);
        if (!cmd) continue;

        let category = "General";
        if (
            cmdName.includes("osu") ||
            ["profile", "recent", "top", "compare", "map", "link", "unlink", "avatar", "banner", "background", "simulate", "leaderboard", "recentbest", "recentlist"].includes(cmdName)
        ) {
            category = "osu!";
        } else if (["help", "ping", "invite", "vote", "config", "prefix"].includes(cmdName)) {
            category = "General";
        } else if (cmdName === "owner") {
            category = "Owner";
        }

        if (!prefixCategories[category]) prefixCategories[category] = [];
        prefixCategories[category].push(cmdName);
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    fields.push({
        name: "Slash Commands",
        value: "Use `/help <command>` to get detailed information about a specific command.",
        inline: false,
    });

    for (const [category, commands] of Object.entries(slashCategories)) {
        fields.push({
            name: `/${category}`,
            value: commands.map((cmd) => `\`/${cmd}\``).join(", "),
            inline: true,
        });
    }

    fields.push({
        name: "Message Commands",
        value: "Use `help <command>` to get detailed information about a specific command.",
        inline: false,
    });

    for (const [category, commands] of Object.entries(prefixCategories)) {
        fields.push({
            name: `${category}`,
            value: commands.map((cmd) => `\`${cmd}\``).join(", "),
            inline: true,
        });
    }

    fields.push({
        name: "Bot Statistics",
        value: `**Servers:** \`${joinedServers}\`\n**Linked Users:** \`${linkedUsers}\`\n**Maps in Database:** \`${downloadedMaps}\`\n**Commands Used:** \`${usedCommands}\``,
        inline: false,
    });

    const hanamiWebsite = "https://hanami.yorunoken.com";
    const inviteLink = "https://discord.com/oauth2/authorize?client_id=995999045157916763&permissions=346176&scope=bot";
    const voteLink = "https://top.gg/bot/995999045157916763";

    fields.push({
        name: "Links",
        value: `[Website](${hanamiWebsite}) • [Invite](${inviteLink}) • [Vote](${voteLink})`,
        inline: false,
    });

    return [
        {
            title: "Hanami Bot - Help",
            description: "Hanami is a Discord bot for osu!",
            fields,
            color: 0xffc0cb,
        },
    ];
}
