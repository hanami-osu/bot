import { beatmapBuilder } from "@builders";
import { EmbedBuilderType } from "@type/builders";
import { Mods } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "@utils/osu";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";
import type { Mod } from "@type/mods";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const { user, mods } = await parseCommandArgs(ctx, Mode.OSU);

    const beatmapId =
        user.beatmapId ??
        (await getBeatmapIdFromContext({
            message: ctx.message,
            channelId: ctx.channelId,
            client: ctx.client,
        }));

    const embeds = await getEmbed(beatmapId, ctx.user.id, mods);
    await ctx.editReply({ embeds });
}

async function getEmbed(beatmapId: string | number | null, authorId: string, mods: Mods) {
    if (typeof beatmapId === "undefined" || beatmapId === null) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: "It seems like the beatmap ID couldn't be found :(\n",
            },
        ];
    }

    const embeds = await beatmapBuilder({
        type: EmbedBuilderType.MAP,
        initiatorId: authorId,
        beatmapId: Number(beatmapId),
        mods: ((typeof mods.name === "string" ? mods.name : mods.name?.acronym)?.match(/.{1,2}/g) as Array<Mod> | null) ?? null,
    });
    return embeds;
}

export const data = {
    name: "beatmap",
    description: "Display statistics of a beatmap.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "map",
                description: "Specify a beatmap link (eg: https://osu.ppy.sh/b/72727)",
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mods",
                description: "Specify a mods combination.",
                min_length: 2,
            },
        ],
    },
    message: {
        aliases: ["map", "m"],
    },
} satisfies CommandData;
