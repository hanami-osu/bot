import { beatmapBuilder } from "../../embed-builders/beatmap";
import { beatmapsetBuilder } from "../../embed-builders/beatmapset";
import { missingBeatmapEmbed, simpleErrorEmbed } from "../../embed-builders/common";
import { EmbedBuilderType, type BeatmapsetBuilderOptions } from "@type/builders";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "@utils/osu";
import { ApplicationCommandOptionType } from "lilybird";
import type { Mod } from "@type/mods";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";

import { CommandContext } from "@utils/command-context";

import { CommandValidationError } from "@utils/args";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, Mode.OSU, undefined, true);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.respondError(error.message, "Check your input");
            return;
        }
        throw error;
    }

    const { user, mods, beatmapsetId } = parsedArgs;
    const selectedMods = ((typeof mods.name === "string" ? mods.name : mods.name?.acronym)?.match(/.{1,2}/g) as Array<Mod> | null) ?? null;

    if (beatmapsetId) {
        const request = await safeParse(v2.beatmaps.details({ type: "set", id: Number(beatmapsetId) }));
        if (!request.success || !request.data) {
            await ctx.editReply({ embeds: [simpleErrorEmbed("I couldn't load that beatmapset. Check the link or try again in a moment.")] });
            return;
        }

        const options: BeatmapsetBuilderOptions = {
            type: EmbedBuilderType.MAPSET,
            initiatorId: ctx.user.id,
            beatmapset: request.data,
            mods: selectedMods,
            page: 0,
        };
        await ctx.sendWithPagination(beatmapsetBuilder(options), options);
        return;
    }

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(ctx.beatmapLookupContext));

    const embeds = await getEmbed(beatmapId, ctx.user.id, selectedMods);
    await ctx.editReply({ embeds });
}

async function getEmbed(beatmapId: string | number | null, authorId: string, mods: Array<Mod> | null) {
    if (typeof beatmapId === "undefined" || beatmapId === null) {
        return [missingBeatmapEmbed()];
    }

    const embeds = await beatmapBuilder({
        type: EmbedBuilderType.MAP,
        initiatorId: authorId,
        beatmapId: Number(beatmapId),
        mods,
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
                description: "Specify a beatmap difficulty or beatmapset link.",
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
