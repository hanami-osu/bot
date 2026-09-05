import { prefixListEmbed } from "@builders";
import { getEntry, insertData } from "@utils/database";
import { DEFAULT_PREFIX, MAX_AMOUNT_OF_PREFIXES } from "@utils/constants";
import { guildPrefixesCache } from "@state/guild-prefixes";
import { Tables } from "@type/database";
import type { ApplicationCommandData, GuildInteraction } from "@lilybird/transformers";
import { CommandData } from "@type/commands";
import { ApplicationCommandOptionType, PermissionFlags } from "lilybird";
import { CommandInteractionContext, CommandIntegrationType } from "@utils/command-context";
import { simpleErrorEmbed, simpleInfoEmbed, simpleSuccessEmbed, simpleWarningEmbed } from "../../embed-builders/common";

const commands: Record<
    string,
    ({
        prefix,
        interaction,
        guildId,
    }: {
        prefix?: string;
        interaction: GuildInteraction<ApplicationCommandData>;
        guildId: string;
    }) => Promise<void>
> = {
    add,
    remove,
    list,
};

const PERMISSIONS_NEEDED_INT = PermissionFlags.MANAGE_GUILD;
const PERMISSION_NEEDED_STRING = "You need the `Manage Server` permission to change prefixes.";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    if (!(await ctx.ensureGuild("Prefixes can only be configured in servers."))) return;

    const { interaction } = ctx;
    if (!interaction?.inGuild()) return;

    const subcommand = interaction.data.subCommand ?? "list";
    const prefix = interaction.data.getString("prefix");
    await commands[subcommand]({ prefix, interaction, guildId: interaction.guildId });
}

async function hasRequiredPermissions(interaction: GuildInteraction<ApplicationCommandData>): Promise<boolean> {
    const permissions = interaction.member.permissions;
    if (permissions && (BigInt(permissions) & BigInt(PERMISSIONS_NEEDED_INT)) !== BigInt(0)) return true;

    await interaction.editReply({ embeds: [simpleErrorEmbed(PERMISSION_NEEDED_STRING, "Missing permissions")] });
    return false;
}

async function add({
    prefix,
    interaction,
    guildId,
}: {
    prefix?: string;
    interaction: GuildInteraction<ApplicationCommandData>;
    guildId: string;
}): Promise<void> {
    if (!(await hasRequiredPermissions(interaction))) return;

    const guild = await getEntry(Tables.GUILD, guildId);
    if (typeof prefix === "undefined" || guild === null) return;
    const { prefixes } = guild;

    if (prefixes && prefixes.length >= MAX_AMOUNT_OF_PREFIXES) {
        await interaction.editReply({
            embeds: [
                simpleWarningEmbed(
                    `This server already has the maximum of **${MAX_AMOUNT_OF_PREFIXES}** custom prefixes. Remove one with \`/prefix remove\` first.`,
                    "Prefix limit reached",
                ),
            ],
        });
        return;
    }

    if (prefixes?.some(pref => pref === prefix)) {
        await interaction.editReply({
            embeds: [
                simpleWarningEmbed(
                    `\`${prefix}\` is already configured. Use \`/prefix list\` to see every prefix.`,
                    "Prefix already added",
                ),
            ],
        });
        return;
    }

    const newPrefixes = prefixes === null ? [prefix] : [...prefixes, prefix];

    await insertData({ table: Tables.GUILD, id: guildId, data: [{ key: "prefixes", value: JSON.stringify(newPrefixes) }] });
    guildPrefixesCache.set(guildId, newPrefixes);

    await interaction.editReply({ embeds: [simpleSuccessEmbed(`\`${prefix}\` is ready to use :3`, "Prefix added")] });
    return;
}

async function remove({
    prefix,
    interaction,
    guildId,
}: {
    prefix?: string;
    interaction: GuildInteraction<ApplicationCommandData>;
    guildId: string;
}): Promise<void> {
    if (!(await hasRequiredPermissions(interaction))) return;

    const guild = await getEntry(Tables.GUILD, guildId);
    if (typeof prefix === "undefined" || guild === null) return;
    const { prefixes } = guild;

    if (prefixes === null) {
        await interaction.editReply({
            embeds: [simpleInfoEmbed("This server has no custom prefixes. Add one with `/prefix add`.", "Nothing to remove")],
        });
        return;
    }

    if (!prefixes.some(pref => pref === prefix)) {
        await interaction.editReply({
            embeds: [
                simpleErrorEmbed(
                    `\`${prefix}\` is not configured. Use \`/prefix list\` to see every prefix.`,
                    "Prefix not found",
                ),
            ],
        });
        return;
    }

    const newPrefixes = prefixes.filter(item => item !== prefix);
    await insertData({
        table: Tables.GUILD,
        id: guildId,
        data: [{ key: "prefixes", value: newPrefixes.length > 0 ? JSON.stringify(newPrefixes) : null }],
    });
    guildPrefixesCache.set(guildId, newPrefixes.length > 0 ? newPrefixes : DEFAULT_PREFIX);

    const embed
        = newPrefixes.length === 0
            ? simpleWarningEmbed(
                    `No custom prefixes remain, so the default prefix is now \`${DEFAULT_PREFIX.join("")}\`.`,
                    "Using the default prefix",
                )
            : simpleSuccessEmbed(`\`${prefix}\` has been removed.`, "Prefix removed");

    await interaction.editReply({ embeds: [embed] });
    return;
}

async function list({
    interaction,
    guildId,
}: {
    interaction: GuildInteraction<ApplicationCommandData>;
    guildId: string;
}): Promise<void> {
    const guild = await getEntry(Tables.GUILD, guildId);
    if (guild === null) return;

    const { prefixes } = guild;

    if (prefixes === null) {
        await interaction.editReply({
            embeds: [
                simpleInfoEmbed(
                    `This server has no custom prefixes. The default is \`${DEFAULT_PREFIX.join("")}\`.`,
                    "Using the default prefix",
                ),
            ],
        });
        return;
    }

    await interaction.editReply({ embeds: [prefixListEmbed(prefixes)] });
}

export const data = {
    name: "prefix",
    description: "Configure the prefix of the bot.",
    hasPrefixVariant: false,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.SUB_COMMAND,
                name: "add",
                description: "Add a prefix",
                options: [{ name: "prefix", description: "The prefix", type: ApplicationCommandOptionType.STRING, required: true }],
            },
            {
                type: ApplicationCommandOptionType.SUB_COMMAND,
                name: "remove",
                description: "Remove a prefix",
                options: [{ name: "prefix", description: "The prefix", type: ApplicationCommandOptionType.STRING, required: true }],
            },
            {
                type: ApplicationCommandOptionType.SUB_COMMAND,
                name: "list",
                description: "Get a list of the current prefixes",
            },
        ],
    },
    availability: {
        integrationTypes: [CommandIntegrationType.GuildInstall],
        contexts: [CommandInteractionContext.Guild],
        unavailableMessage: "Prefixes can only be configured in servers.",
    },
} satisfies CommandData;
