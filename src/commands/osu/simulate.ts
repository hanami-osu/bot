import { simulateBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "@utils/osu";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const { user, mods, flags } = (await parseCommandArgs(ctx, Mode.OSU));

    const context = ctx.isInteraction 
        ? { channelId: ctx.channelId, client: ctx.client }
        : { message: ctx.message, client: ctx.client };

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(context));
    if (!beatmapId) {
        await ctx.editReply({
            embeds: [
                {
                    type: EmbedType.Rich,
                    title: "Uh oh! :x:",
                    description: "It seems like the beatmap ID couldn't be found :(\n",
                },
            ],
        });
        return;
    }

    const simulationOptions = ctx.isInteraction ? {
        mods: ctx.interaction!.data.getString("mods"),
        combo: ctx.interaction!.data.getNumber("combo") || undefined,
        accuracy: ctx.interaction!.data.getNumber("acc") || undefined,
        clockRate: ctx.interaction!.data.getNumber("clock_rate") || undefined,
        bpm: ctx.interaction!.data.getNumber("bpm") || undefined,
    } : {
        mods: mods.name,
        combo: Number(flags.combo) || undefined,
        accuracy: Number(flags.acc || flags.accuracy) || undefined,
        clockRate: Number(flags.clock_rate || flags.clockrate) || undefined,
        bpm: Number(flags.bpm) || undefined,
    };

    const reply = await getEmbeds(String(beatmapId), ctx.user.id, simulationOptions);
    await ctx.editReply(reply);
}

async function getEmbeds(beatmapId: string, authorId: string, simulationOptions: any): Promise<MessageReplyOptions> {
    const embeds = await simulateBuilder({
        type: EmbedBuilderType.SIMULATE,
        initiatorId: authorId,
        beatmapId: Number(beatmapId),
        ...simulationOptions,
    });

    return { embeds };
}

export const data = {
    name: "simulate",
    description: "Simulate a score on a beatmap.",
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
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mode",
                description: "Specify a gamemode.",
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "combo",
                description: "Specify a combo.",
                min_value: 0,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "acc",
                description: "Specify an accuracy.",
                min_value: 0,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "clock_rate",
                description: "Specify a custom clockrate that overwrites any other rate changes.",
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "bpm",
                description: "Specify a custom BPM.",
            },
        ],
    },
    message: {
        aliases: ["s", "sim"],
    },
} satisfies CommandData;
