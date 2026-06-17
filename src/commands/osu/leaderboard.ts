import { leaderboardBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext, getBeatmapTopScores } from "@utils/osu";
import { createPaginationActionRow } from "@utils/pagination";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";
import type { LeaderboardBuilderOptions } from "@type/builders";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import type { GameMode, Beatmap } from "@type/osu";

const modeAliases: Record<string, { isGlobal: boolean }> = {
    leaderboard: { isGlobal: true },
    lb: { isGlobal: true },
    countryleaderboard: { isGlobal: false },
    countrylb: { isGlobal: false },
    clb: { isGlobal: false },
    ct: { isGlobal: false },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let isGlobal = true;
    let page = 0;

    if (ctx.isInteraction) {
        isGlobal = (ctx.interaction!.data.getString("type") ?? "global") === "global";
        page = (ctx.interaction!.data.getNumber("page") ?? 1) - 1;
    } else {
        isGlobal = modeAliases[ctx.commandName ?? "leaderboard"]?.isGlobal ?? true;
    }

    const { user, mods, flags } = await parseCommandArgs(ctx, Mode.OSU);
    if (!ctx.isInteraction) {
        page = Number(flags.p ?? flags.page ?? 1) - 1;
    }

    const { reply, embedOptions } = await getEmbeds(user.beatmapId ?? undefined, ctx.user.id, mods, isGlobal, page, ctx);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(
    beatmapId: string | undefined,
    authorId: string,
    mods: any,
    isGlobal: boolean,
    page: number,
    context: CommandContext,
): Promise<{ reply: MessageReplyOptions; embedOptions?: LeaderboardBuilderOptions }> {
    const resolvedBeatmapId = beatmapId ?? (await getBeatmapIdFromContext(context.beatmapLookupContext));
    if (typeof resolvedBeatmapId === "undefined" || resolvedBeatmapId === null) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like the beatmap ID couldn't be found :(\n",
                    },
                ],
            },
        };
    }

    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: Number(resolvedBeatmapId) }));
    if (!beatmapRequest.success) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like this beatmap doesn't exist! :(",
                    },
                ],
            },
        };
    }
    const beatmap = beatmapRequest.data;

    if (beatmap.status === "pending" || beatmap.status === "wip" || beatmap.status === "graveyard") {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like this beatmap's leaderboard doesn't exist! :(",
                    },
                ],
            },
        };
    }

    const scoresRequest = await safeParse(
        getBeatmapTopScores({
            beatmapId: Number(resolvedBeatmapId),
            mode: beatmap.mode as GameMode,
            isGlobal,
            mods: mods.name ? ((typeof mods.name === "string" ? mods.name : mods.name.acronym).match(/.{1,2}/g) as Array<string>) : undefined,
        }),
    );

    if (!scoresRequest.success) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "Failed to fetch top scores! If you were using mods or a country leaderboard, maybe my osu! supporter ran out? Support me at https://yorunoken.com#support :3",
                    },
                ],
            },
        };
    }

    const scores = scoresRequest.data;

    if (scores.length === 0) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like this beatmap's leaderboard doesn't exist! :(",
                    },
                ],
            },
        };
    }

    const embedOptions: LeaderboardBuilderOptions = {
        type: EmbedBuilderType.LEADERBOARD,
        initiatorId: authorId,
        page,
        beatmap: beatmap as Beatmap,
        scores,
    };

    const embeds = await leaderboardBuilder(embedOptions);
    return {
        reply: {
            embeds,
            components: createPaginationActionRow(embedOptions),
        },
        embedOptions,
    };
}

export const data = {
    name: "leaderboard",
    description: "Display the leaderboard of a beatmap",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "type",
                description: "The type of the leaderboard.",
                choices: [
                    { name: "Global Leaderboard", value: "global" },
                    { name: "Turkish Leaderboard", value: "country" },
                ],
            },
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
                type: ApplicationCommandOptionType.NUMBER,
                name: "page",
                description: "Specify a page.",
            },
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
} satisfies CommandData;
