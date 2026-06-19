import { playBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { CommandValidationError, parseCommandArgs, parsePrefixPageFlag } from "@utils/args";
import { createPaginationActionRow, ITEMS_PER_PAGE } from "@utils/pagination";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";
import type { PlaysBuilderOptions } from "@type/builders";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode: Mode }> = {
    rb: { mode: Mode.OSU },
    rbt: { mode: Mode.TAIKO },
    rbm: { mode: Mode.MANIA },
    rbc: { mode: Mode.FRUITS },
    recentbest: { mode: Mode.OSU },
    recentbesttaiko: { mode: Mode.TAIKO },
    recentbestmania: { mode: Mode.MANIA },
    recentbestcatch: { mode: Mode.FRUITS },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const mode = modeAliases[ctx.commandName ?? "recentbest"]?.mode ?? Mode.OSU;
    const { user, mods, flags } = await parseCommandArgs(ctx, mode);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    let index = ctx.isInteraction ? ctx.interaction!.data.getInteger("index") : ctx.index;
    let page: number | undefined;
    try {
        page = ctx.isInteraction ? ctx.interaction!.data.getInteger("page") : parsePrefixPageFlag(flags, Math.ceil(USER_SCORE_FETCH_LIMIT / ITEMS_PER_PAGE));
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.editReply(error.message);
            return;
        }
        throw error;
    }

    if (typeof page === "undefined" && typeof index === "undefined") {
        page = ctx.isMessage ? 0 : 1;
    }

    if (page && ctx.isInteraction) page -= 1;
    if (index && ctx.isInteraction) index -= 1;

    // For prefix, if neither page nor index is set, it defaults to page=0.
    // For interaction, if neither is set, it defaults to page=1 -> 0.

    if (typeof page === "undefined" && typeof index === "undefined") page = 0;
    const isPage = typeof page !== "undefined";

    const titleFilter = flags.filter?.trim() || undefined;
    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, index, page, isPage, mods, titleFilter);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(
    user: SuccessUser,
    authorId: string,
    index: number | undefined,
    page: number | undefined,
    isPage: boolean,
    mods: any,
    titleFilter: string | undefined,
): Promise<{ reply: MessageReplyOptions; embedOptions?: PlaysBuilderOptions }> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: `It seems like the user **\`${user.banchoId}\`** doesn't exist! :(`,
                    },
                ],
            },
        };
    }
    const osuUser = osuUserRequest.data;

    const plays = await getUserScores(osuUser.id, PlayType.BEST, { query: { mode: user.mode, limit: USER_SCORE_FETCH_LIMIT } }, user.authorDb);

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: `It seems like \`${osuUser.username}\` doesn't have any plays, maybe they should go set some :)`,
                    },
                ],
            },
        };
    }

    const embedOptions: PlaysBuilderOptions = {
        type: EmbedBuilderType.PLAYS,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
        isMultiple: true,
        sortByDate: true,
        authorDb: user.authorDb,
        isPage,
        page,
        index,
        mods,
        titleFilter,
        plays,
    };

    const embeds = await playBuilder(embedOptions);
    return {
        reply: {
            embeds,
            components: createPaginationActionRow(embedOptions),
        },
        embedOptions,
    };
}

export const data: CommandData = {
    name: "recentbest",
    description: "Display most recent top play(s) of a user.",
    hasPrefixVariant: true,
    application: {
        options: [
            usernameOption(),
            modeOption(),
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "index",
                description: "Specify an index.",
                min_value: 1,
                max_value: USER_SCORE_FETCH_LIMIT,
            },
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "page",
                description: "Specify a page, defaults to 1.",
                min_value: 1,
                max_value: Math.ceil(USER_SCORE_FETCH_LIMIT / ITEMS_PER_PAGE),
            },
            modsOption(),
            modsActionOption(),
            gradeOption(),
            filterOption(),
            discordOption(),
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
};
