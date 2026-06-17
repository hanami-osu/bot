import { backgroundBuilder } from "@builders";
import { EmbedBuilderType } from "@type/builders";
import { CommandData } from "@type/commands";
import { Mode, type Beatmap } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { getBeatmapIdFromContext } from "@utils/osu";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const { user } = await parseCommandArgs(ctx, Mode.OSU);

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(ctx.beatmapLookupContext));

    const embeds = await getEmbed(beatmapId, ctx.user.id);
    await ctx.editReply({ embeds });
}

async function getEmbed(beatmapId: string | number | null, authorId: string) {
    if (typeof beatmapId === "undefined" || beatmapId === null) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: "It seems like the beatmap ID couldn't be found :(\n",
            },
        ];
    }

    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: Number(beatmapId) }));
    if (!beatmapRequest.success) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: "It seems like this beatmap doesn't exist! :(",
            },
        ];
    }
    const beatmap = beatmapRequest.data;

    const embeds = backgroundBuilder({
        type: EmbedBuilderType.BACKGROUND,
        initiatorId: authorId,
        beatmap: beatmap as Beatmap,
    });
    return embeds;
}

export const data = {
    name: "background",
    description: "Display background of a beatmap.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "map",
                description: "Specify a beatmap link (eg: https://osu.ppy.sh/b/72727)",
            },
        ],
    },
    message: {
        aliases: ["bg"],
    },
} satisfies CommandData;
