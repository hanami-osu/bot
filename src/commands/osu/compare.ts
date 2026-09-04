import { compareBuilder } from "../../embed-builders/compare";
import {
    beatmapNotFoundEmbed,
    missingBeatmapEmbed,
    simpleInfoEmbed,
    userNotFoundEmbed,
} from "../../embed-builders/common";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType, type CompareBuilderOptions, type ModStructure } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, type Beatmap } from "@type/osu";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "@utils/osu";
import { getBeatmapUserScores } from "@utils/score-api";
import { createPaginationActionRow, getTotalItems } from "@utils/pagination";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType } from "lilybird";
import { discordOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode?: Mode }> = {
    შედარება: {},
    mog: {},
    gap: {},
    c: {},
    compare: {},
    compareosu: { mode: Mode.OSU },
    comparetaiko: { mode: Mode.TAIKO },
    comparemania: { mode: Mode.MANIA },
    comparecatch: { mode: Mode.FRUITS },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const mode = ctx.isMessage ? modeAliases[ctx.commandName ?? "compare"]?.mode : undefined;

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, mode);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.respondError(error.message, "Check your input");
            return;
        }
        throw error;
    }

    const { user, mods } = parsedArgs;

    if (user.type === UserType.FAIL) {
        await ctx.respondError(user.failMessage, "Account not linked");
        return;
    }

    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, mods, ctx);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(
    user: SuccessUser,
    authorId: string,
    mods: ModStructure,
    context: CommandContext,
): Promise<{ reply: MessageReplyOptions; embedOptions?: CompareBuilderOptions }> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            reply: {
                embeds: [userNotFoundEmbed(user.banchoId)],
            },
        };
    }
    const osuUser = osuUserRequest.data;

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(context.beatmapLookupContext));
    if (typeof beatmapId === "undefined" || beatmapId === null) {
        return {
            reply: {
                embeds: [missingBeatmapEmbed()],
            },
        };
    }

    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: Number(beatmapId) }));
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

    const plays = await getBeatmapUserScores(beatmap.id, osuUser.id, { query: { mode: user.mode } }, user.authorDb);

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [simpleInfoEmbed(`\`${osuUser.username}\` has no plays on that beatmap in \`${user.mode}\` yet.`, "Nothing to show")],
            },
        };
    }

    const embedOptions: CompareBuilderOptions = {
        type: EmbedBuilderType.COMPARE,
        initiatorId: authorId,
        mode: user.mode,
        authorDb: user.authorDb,
        user: osuUser,
        beatmap: beatmap as Beatmap,
        plays,
        mods,
        page: 0,
    };

    const embeds = await compareBuilder(embedOptions);
    return {
        reply: {
            embeds,
            components: getTotalItems(embedOptions) > 0 ? createPaginationActionRow(embedOptions) : [],
        },
        embedOptions,
    };
}

export const data: CommandData = {
    name: "compare",
    description: "Display play(s) of a user on a beatmap.",
    hasPrefixVariant: true,
    application: {
        options: [
            usernameOption(),
            {
                type: ApplicationCommandOptionType.STRING,
                name: "map",
                description: "Specify a beatmap link (eg: https://osu.ppy.sh/b/72727)",
            },
            modeOption(),
            modsOption(),
            modsActionOption(),
            gradeOption(),
            discordOption(),
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
};
