import { CommandData } from "@type/commands";
import { ApplicationCommandOptionType, type Embed } from "lilybird";
import { getEntry, insertData } from "@utils/database";
import { ScoreEmbed, Tables } from "@type/database";
import type { ApplicationCommandData, GuildInteraction } from "@lilybird/transformers";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    const { interaction } = ctx;
    if (!interaction) return;

    const { data } = interaction;
    const { id: userId, username } = interaction.member.user;

    const scoreEmbedData = data.getNumber("score_embeds");
    const modeData = data.getString("mode");
    const embedTypeData = data.getString("embed_type");
    const scoreDataValue = data.getNumber("score_data");

    if (typeof modeData === "undefined" && typeof scoreEmbedData === "undefined" && typeof embedTypeData === "undefined" && typeof scoreDataValue === "undefined") {
        await list(interaction, userId);
        return;
    }

    const changes = [];
    // insert mode data to db
    if (typeof modeData !== "undefined") {
        (await insertData({ table: Tables.USER, id: userId, data: [{ key: "mode", value: modeData }] }));
        changes.push({ type: "mode", data: modeData });
    }

    if (typeof scoreEmbedData !== "undefined") {
        (await insertData({ table: Tables.USER, id: userId, data: [{ key: "score_embeds", value: scoreEmbedData }] }));
        changes.push({ type: "score_embeds", data: ScoreEmbed[scoreEmbedData] });
    }

    if (typeof embedTypeData !== "undefined") {
        (await insertData({ table: Tables.USER, id: userId, data: [{ key: "embed_type", value: embedTypeData }] }));
        changes.push({ type: "embed_type", data: embedTypeData });
    }

    if (typeof scoreDataValue !== "undefined") {
        (await insertData({ table: Tables.USER, id: userId, data: [{ key: "score_data", value: scoreDataValue }] }));
        changes.push({ type: "score_data", data: scoreDataValue === 0 ? "Stable" : "Lazer" });
    }

    let changesText = "";
    for (const change of changes) {
        changesText += `${change.type}: ${change.data}\n`;
    }

    await interaction.editReply({
        embeds: [
            {
                title: `Successfully changes configs for ${username}`,
                description: `Changed configs:\n${changesText}`,
            },
        ],
    });
}

async function list(interaction: GuildInteraction<ApplicationCommandData>, userId: string): Promise<void> {
    const defaults: Record<string, string> = {
        score_embeds: "Maximized",
        mode: "None",
        score_data: "Stable",
        unknown: "unknown",
    };

    let user = (await getEntry(Tables.USER, userId));
    if (!user) {
        (await insertData({ table: Tables.USER, id: userId, data: [{ key: "banchoId", value: null }] }));
        user = { banchoId: null, mode: null, score_embeds: null, embed_type: null, score_data: null, id: userId };
    }

    const embeds: Embed.Structure = { fields: [], title: `Config settings of ${interaction.member.user.username}` };

    if (user) {
        for (const [key, v] of Object.entries(user)) {
            const value = v as string | number | null;
            if (key === "id" || key === "banchoId") continue;

            if (value !== null) {
                let displayValue: string;

                if (key === "score_embeds" && typeof value === "number") {
                    displayValue = ScoreEmbed[value];
                } else if (key === "score_data" && typeof value === "number") {
                    displayValue = value === 0 ? "Stable" : "Lazer";
                } else {
                    displayValue = typeof value === "number" ? value.toString() : value;
                }

                embeds.fields?.push({ name: key, value: displayValue });
            } else {
                embeds.fields?.push({ name: key, value: defaults[key || "unknown"] });
            }
        }
    }

    await interaction.editReply({ embeds: [embeds] });
}

export const data = {
    name: "config",
    description: "Change bot configuration.",
    hasPrefixVariant: false,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "score_embeds",
                description: "Specify what size score embeds should be. (compare, recent...)",
                choices: [
                    { name: "Maximized", value: 1 },
                    { name: "Minimized", value: 0 },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mode",
                description: "Specify an osu! mode (none defaults to osu)",
                choices: [
                    { name: "None", value: "osu" },
                    { name: "osu", value: "osu" },
                    { name: "mania", value: "mania" },
                    { name: "taiko", value: "taiko" },
                    { name: "ctb", value: "fruits" },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "embed_type",
                description: "Specify an osu! embed type. Default: Hanami",
                choices: [
                    { name: "Bathbot", value: "bathbot" },
                    { name: "owo", value: "owobot" },
                    { name: "Hanami", value: "hanami" },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "score_data",
                description: "Specify score data source. Stable: old osu!, Lazer: new osu!lazer",
                choices: [
                    { name: "Stable", value: 0 },
                    { name: "Lazer", value: 1 },
                ],
                required: false,
            },
        ],
    },
} satisfies CommandData;
