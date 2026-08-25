import { configListEmbed, configUpdatedEmbed, type ConfigChange } from "@builders";
import type { CommandData } from "@type/commands";
import { ScoreEmbed, Tables } from "@type/database";
import { ApplicationCommandOptionType } from "lilybird";
import { CommandContext } from "@utils/command-context";
import { getEntry, insertData } from "@utils/database";

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

    const hasNoChanges =
        typeof modeData === "undefined" &&
        typeof scoreEmbedData === "undefined" &&
        typeof embedTypeData === "undefined" &&
        typeof scoreDataValue === "undefined";

    if (hasNoChanges) {
        await list(ctx, userId);
        return;
    }

    const changes: Array<ConfigChange> = [];
    const updates: Array<{ key: "mode" | "score_embeds" | "embed_type" | "score_data"; value: string | number }> = [];

    if (typeof modeData !== "undefined") {
        updates.push({ key: "mode", value: modeData });
        changes.push({ type: "mode", data: modeData });
    }

    if (typeof scoreEmbedData !== "undefined") {
        updates.push({ key: "score_embeds", value: scoreEmbedData });
        changes.push({ type: "score_embeds", data: ScoreEmbed[scoreEmbedData] });
    }

    if (typeof embedTypeData !== "undefined") {
        updates.push({ key: "embed_type", value: embedTypeData });
        changes.push({ type: "embed_type", data: embedTypeData });
    }

    if (typeof scoreDataValue !== "undefined") {
        updates.push({ key: "score_data", value: scoreDataValue });
        changes.push({ type: "score_data", data: scoreDataValue === 0 ? "Stable" : "Lazer" });
    }

    await insertData({ table: Tables.USER, id: userId, data: updates });

    await interaction.editReply({
        content: getWebConfigNotice(),
        embeds: [configUpdatedEmbed(username, changes)],
    });
}

async function list(ctx: CommandContext, userId: string): Promise<void> {
    let user = await getEntry(Tables.USER, userId);

    if (!user) {
        await insertData({
            table: Tables.USER,
            id: userId,
            data: [{ key: "banchoId", value: null }],
        });

        user = {
            id: userId,
            banchoId: null,
            mode: null,
            score_embeds: null,
            embed_type: null,
            score_data: null,
        };
    }

    await ctx.editReply({
        content: getWebConfigNotice(),
        embeds: [configListEmbed(ctx.user.username, user)],
    });
}

function getWebConfigNotice(): string | undefined {
    const webUrl = process.env.HANAMI_WEB_URL;
    if (!webUrl) return undefined;

    const profileUrl = new URL("/profile", webUrl);

    return `You can also manage your bot preferences on [Hanami Web](<${profileUrl.toString()}>).`;
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
                description: "Specify the size of recent/top/firsts score embeds.",
                choices: [
                    {
                        name: "Maximized",
                        value: 1,
                    },
                    {
                        name: "Minimized",
                        value: 0,
                    },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mode",
                description: "Specify an osu! mode. osu!standard is the default.",
                choices: [
                    {
                        name: "osu",
                        value: "osu",
                    },
                    {
                        name: "mania",
                        value: "mania",
                    },
                    {
                        name: "taiko",
                        value: "taiko",
                    },
                    {
                        name: "ctb",
                        value: "fruits",
                    },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "embed_type",
                description: "Specify the score embed style. Default: Hanami",
                choices: [
                    {
                        name: "Bathbot",
                        value: "bathbot",
                    },
                    {
                        name: "owo",
                        value: "owobot",
                    },
                    {
                        name: "Hanami",
                        value: "hanami",
                    },
                ],
                required: false,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "score_data",
                description: "Specify score data source. Stable: old osu!, Lazer: new osu!lazer",
                choices: [
                    {
                        name: "Stable",
                        value: 0,
                    },
                    {
                        name: "Lazer",
                        value: 1,
                    },
                ],
                required: false,
            },
        ],
    },
} satisfies CommandData;
