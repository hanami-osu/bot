import { configListEmbed, configUpdatedEmbed, type ConfigChange } from "@builders";
import { CommandData } from "@type/commands";
import { ApplicationCommandOptionType } from "lilybird";
import { getEntry, insertData } from "@utils/database";
import { ScoreEmbed, Tables } from "@type/database";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    const { interaction } = ctx;
    if (!interaction) return;

    const { data } = interaction;
    const { id: userId, username } = ctx.user;

    const scoreEmbedData = data.getNumber("score_embeds");
    const modeData = data.getString("mode");
    const embedTypeData = data.getString("embed_type");
    const scoreDataValue = data.getNumber("score_data");

    if (typeof modeData === "undefined" && typeof scoreEmbedData === "undefined" && typeof embedTypeData === "undefined" && typeof scoreDataValue === "undefined") {
        await list(ctx, userId);
        return;
    }

    const changes: Array<ConfigChange> = [];
    if (typeof modeData !== "undefined") {
        await insertData({ table: Tables.USER, id: userId, data: [{ key: "mode", value: modeData }] });
        changes.push({ type: "mode", data: modeData });
    }

    if (typeof scoreEmbedData !== "undefined") {
        await insertData({ table: Tables.USER, id: userId, data: [{ key: "score_embeds", value: scoreEmbedData }] });
        changes.push({ type: "score_embeds", data: ScoreEmbed[scoreEmbedData] });
    }

    if (typeof embedTypeData !== "undefined") {
        await insertData({ table: Tables.USER, id: userId, data: [{ key: "embed_type", value: embedTypeData }] });
        changes.push({ type: "embed_type", data: embedTypeData });
    }

    if (typeof scoreDataValue !== "undefined") {
        await insertData({ table: Tables.USER, id: userId, data: [{ key: "score_data", value: scoreDataValue }] });
        changes.push({ type: "score_data", data: scoreDataValue === 0 ? "Stable" : "Lazer" });
    }

    await interaction.editReply({
        embeds: [configUpdatedEmbed(username, changes)],
    });
}

async function list(ctx: CommandContext, userId: string): Promise<void> {
    let user = await getEntry(Tables.USER, userId);
    if (!user) {
        await insertData({ table: Tables.USER, id: userId, data: [{ key: "banchoId", value: null }] });
        user = { banchoId: null, mode: null, score_embeds: null, embed_type: null, score_data: null, id: userId };
    }

    await ctx.editReply({ embeds: [configListEmbed(ctx.user.username, user)] });
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
                description: "Specify an osu! mode. osu!standard is the default.",
                choices: [
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
