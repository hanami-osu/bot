import { BOT_INVITE_URL, BOT_VOTE_URL, HANAMI_WEBSITE_URL } from "@utils/constants";
import { commandsCache, commandAliasesCache } from "@state/command-registry";
import type { Embed } from "lilybird";

const COMMAND_CATEGORIES = {
    "Players": ["link", "unlink", "profile", "avatar", "banner"],
    "Scores & plays": ["recent", "recentbest", "recentlist", "top", "compare", "leaderboard"],
    "Beatmaps & performance": ["beatmap", "background", "simulate", "pp", "whatif"],
    "Hanami": ["help", "ping", "config", "prefix", "invite", "vote"],
} as const;

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
                                ?.map(opt => `\`${opt.name}\` - ${opt.description} ${opt.required ? "(required)" : ""}`)
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

function formatCommandList(commandNames: ReadonlyArray<string>): string {
    return commandNames
        .filter(commandName => commandsCache.has(commandName))
        .map(commandName => `\`/${commandName}\``)
        .join(", ");
}

async function displayAllCommands(): Promise<Array<Embed.Structure>> {
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
            name: "Start here",
            value: "`/link` your osu! account, then try `/profile`, `/recent`, or `/top`.",
            inline: false,
        },
    ];

    const categorizedCommands = new Set<string>();
    for (const [category, commandNames] of Object.entries(COMMAND_CATEGORIES)) {
        const commands = formatCommandList(commandNames);
        if (!commands) continue;

        commandNames.forEach(commandName => categorizedCommands.add(commandName));
        fields.push({
            name: category,
            value: commands,
            inline: true,
        });
    }

    const uncategorizedCommands = Array.from(commandsCache.keys())
        .filter(commandName => commandName !== "owner" && !categorizedCommands.has(commandName))
        .sort();
    if (uncategorizedCommands.length > 0) {
        fields.push({
            name: "More",
            value: formatCommandList(uncategorizedCommands),
            inline: true,
        });
    }

    fields.push(
        {
            name: "Need details?",
            value: "Use `/help <command>` for options and usage. Prefix variants also support `help <command>`.",
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
            description: "Explore osu! profiles, scores, beatmaps, and performance tools without leaving Discord.",
            fields,
            color: 0xffc0cb,
        },
    ];
}

export function welcomeBuilder(): Embed.Structure {
    return {
        title: "Welcome to Hanami!",
        description: "Explore osu! profiles, recent plays, top scores, beatmaps, and performance tools from Discord.",
        fields: [
            {
                name: "Start here",
                value: "Run `/link`, then try `/profile`, `/recent`, or `/top`. Use `/help` to see everything else.",
            },
            {
                name: "Optional server setup",
                value: "Slash commands work immediately. Changing message-command prefixes with `/prefix` requires Manage Server.",
            },
        ],
        color: 0xffc0cb,
    };
}
