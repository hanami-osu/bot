import { leaderboardBuilder } from "../../embed-builders/leaderboard";
import {
    beatmapNotFoundEmbed,
    missingBeatmapEmbed,
    simpleErrorEmbed,
    simpleInfoEmbed,
} from "../../embed-builders/common";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { CommandData } from "@type/commands";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext, getBeatmapTopScores } from "@utils/osu";
import { createPaginationActionRow, ITEMS_PER_PAGE } from "@utils/pagination";
import { ApplicationCommandOptionType } from "lilybird";
import type { LeaderboardBuilderOptions } from "@type/builders";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import type { GameMode, Beatmap } from "@type/osu";
import { modsOption } from "./options";

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

    if (ctx.isInteraction) {
        isGlobal = (ctx.interaction!.data.getString("type") ?? "global") === "global";
    } else {
        isGlobal = modeAliases[ctx.commandName ?? "leaderboard"]?.isGlobal ?? true;
    }

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.respondError(error.message, "Check your input");
            return;
        }
        throw error;
    }

    const { user, mods, page = 0 } = parsedArgs;
    const { reply, embedOptions } = await getEmbeds(
        user.beatmapId ?? undefined,
        ctx.user.id,
        user.authorDb,
        mods,
        isGlobal,
        page,
        ctx,
    );
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(
    beatmapId: string | undefined,
    authorId: string,
    authorDb: LeaderboardBuilderOptions["authorDb"],
    mods: any,
    isGlobal: boolean,
    page: number,
    context: CommandContext,
): Promise<{ reply: MessageReplyOptions; embedOptions?: LeaderboardBuilderOptions }> {
    const resolvedBeatmapId = beatmapId ?? (await getBeatmapIdFromContext(context.beatmapLookupContext));
    if (typeof resolvedBeatmapId === "undefined" || resolvedBeatmapId === null) {
        return {
            reply: {
                embeds: [missingBeatmapEmbed()],
            },
        };
    }

    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: Number(resolvedBeatmapId) }));
    if (!beatmapRequest.success) {
        return {
            reply: {
                embeds: [beatmapNotFoundEmbed()],
            },
        };
    }
    const beatmap = beatmapRequest.data;

    if (beatmap.status === "pending" || beatmap.status === "wip" || beatmap.status === "graveyard") {
        return {
            reply: {
                embeds: [simpleInfoEmbed("That beatmap doesn't have a public leaderboard yet.", "Nothing to show")],
            },
        };
    }

    const scoresRequest = await safeParse(
        getBeatmapTopScores({
            beatmapId: Number(resolvedBeatmapId),
            mode: beatmap.mode as GameMode,
            isGlobal,
            authorDb,
            mods: mods.name
                ? ((typeof mods.name === "string" ? mods.name : mods.name.acronym).match(/.{1,2}/g) as Array<string>)
                : undefined,
        }),
    );

    if (!scoresRequest.success) {
        return {
            reply: {
                embeds: [simpleErrorEmbed("I couldn't fetch that leaderboard right now. Try again in a moment.")],
            },
        };
    }

    const scores = scoresRequest.data;

    if (scores.length === 0) {
        return {
            reply: {
                embeds: [simpleInfoEmbed("No scores are on this leaderboard yet. Maybe you'll be first :3", "Nothing to show")],
            },
        };
    }

    if (page < 0 || page * ITEMS_PER_PAGE >= scores.length) {
        return {
            reply: {
                embeds: [simpleErrorEmbed("That page is out of range for this leaderboard.", "Check your input")],
            },
        };
    }

    const embedOptions: LeaderboardBuilderOptions = {
        type: EmbedBuilderType.LEADERBOARD,
        initiatorId: authorId,
        page,
        beatmap: beatmap as Beatmap,
        authorDb,
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

export const data: CommandData = {
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
            modsOption(),
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "page",
                description: "Specify a page.",
                min_value: 1,
            },
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
};
