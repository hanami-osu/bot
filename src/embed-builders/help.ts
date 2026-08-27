import { Tables } from "@type/database";
import { getRowCount, getRowSum } from "@utils/database";
import { BOT_INVITE_URL, BOT_VOTE_URL, HANAMI_WEBSITE_URL } from "@utils/constants";
import { commandsCache, commandAliasesCache } from "@state/command-registry";
import type { Embed } from "lilybird";

const OSU_COMMANDS = new Set([
    "profile",
    "recent",
    "top",
    "compare",
    "map",
    "link",
    "unlink",
    "avatar",
    "banner",
    "background",
    "simulate",
    "leaderboard",
    "recentbest",
    "recentlist",
    "pp",
    "whatif",
]);

export async function helpBuilder(commandName?: string, preferSlash?: boolean): Promise<Array<Embed.Structure>> {
    if (commandName) return displayCommandInfo(commandName, preferSlash);
    return displayAllCommands();
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
                        value:
                            data.application?.options
                                ?.map((opt) => `\`${opt.name}\` - ${opt.description} ${opt.required ? "(required)" : ""}`)
                                .join("\n") ?? "No options",
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

    const cooldown = formatCooldown(data.message?.cooldown);
    return [
        {
            title: data.name,
            description: data.description,
            fields: [
                {
                    name: "Type",
                    value: "Message Command",
                    inline: true,
                },
                {
                    name: "Cooldown",
                    value: cooldown,
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

export function formatCooldown(cooldownMs?: number): string {
    const cooldownSeconds = (cooldownMs ?? 1000) / 1000;
    return `${cooldownSeconds} second${cooldownSeconds === 1 ? "" : "s"}`;
}

function getCommandCategory(commandName: string): string {
    if (commandName.includes("osu") || OSU_COMMANDS.has(commandName)) return "osu!";
    if (commandName === "owner") return "Owner";
    return "General";
}

async function displayAllCommands(): Promise<Array<Embed.Structure>> {
    const joinedServers = await getRowCount(Tables.GUILD);
    const linkedUsers = await getRowCount(Tables.USER);
    const downloadedMaps = await getRowCount(Tables.MAP);
    const usedCommands = await getRowSum(Tables.COMMAND);

    const slashCategories: Record<string, Array<string>> = {};
    const prefixCategories: Record<string, Array<string>> = {};

    for (const commandName of Array.from(commandsCache.keys()).sort()) {
        const command = commandsCache.get(commandName);
        if (!command) continue;

        const category = getCommandCategory(commandName);
        (slashCategories[category] ??= []).push(commandName);
        if (command.data.hasPrefixVariant) (prefixCategories[category] ??= []).push(commandName);
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
            name: "Slash Commands",
            value: "Use `/help <command>` to get detailed information about a specific command.",
            inline: false,
        },
    ];

    for (const [category, commands] of Object.entries(slashCategories)) {
        fields.push({
            name: `/${category}`,
            value: commands.map((command) => `\`/${command}\``).join(", "),
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
            name: category,
            value: commands.map((command) => `\`${command}\``).join(", "),
            inline: true,
        });
    }

    fields.push(
        {
            name: "Bot Statistics",
            value: `**Servers:** \`${joinedServers}\`\n**Linked Users:** \`${linkedUsers}\`\n**Maps in Database:** \`${downloadedMaps}\`\n**Commands Used:** \`${usedCommands}\``,
            inline: false,
        },
        {
            name: "Links",
            value: `[Website](${HANAMI_WEBSITE_URL}) • [Invite](${BOT_INVITE_URL}) • [Vote](${BOT_VOTE_URL})`,
            inline: false,
        },
    );

    return [
        {
            title: "Hanami - Help",
            description: "Hanami is a Discord bot for osu!",
            fields,
            color: 0xffc0cb,
        },
    ];
}
