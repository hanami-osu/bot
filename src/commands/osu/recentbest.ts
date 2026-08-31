import { UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { getFetchedPlayReply } from "@services/play-service";
import { CommandValidationError, parseCommandArgs, validatePage } from "@utils/args";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { ApplicationCommandOptionType } from "lilybird";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode?: Mode }> = {
    rb: {},
    rbt: { mode: Mode.TAIKO },
    rbm: { mode: Mode.MANIA },
    rbc: { mode: Mode.FRUITS },
    recentbest: {},
    recentbesttaiko: { mode: Mode.TAIKO },
    recentbestmania: { mode: Mode.MANIA },
    recentbestcatch: { mode: Mode.FRUITS },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const mode = ctx.isMessage ? modeAliases[ctx.commandName ?? "recentbest"]?.mode : undefined;
    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, mode);
        validatePage(parsedArgs.page);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.editReply(error.message);
            return;
        }
        throw error;
    }

    const { user, mods, titleFilter } = parsedArgs;

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const { index } = parsedArgs;
    let { page } = parsedArgs;

    if (typeof page === "undefined" && typeof index === "undefined") page = 0;
    const isPage = typeof page !== "undefined";

    const { reply, embedOptions } = await getFetchedPlayReply({
        user,
        authorId: ctx.user.id,
        playType: PlayType.BEST,
        index,
        page,
        isPage,
        isMultiple: true,
        sortByDate: true,
        mods,
        titleFilter,
        emptyMessage: username => `It seems like \`${username}\` doesn't have any plays, maybe they should go set some :)`,
    });
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
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
