import { UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { getFetchedPlayReply } from "@services/play-service";
import { CommandValidationError, parseCommandArgs, validatePage } from "@utils/args";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { ApplicationCommandOptionType } from "lilybird";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode?: Mode; includeFails: boolean }> = {
    rl: { includeFails: true },
    rlt: { mode: Mode.TAIKO, includeFails: true },
    rlm: { mode: Mode.MANIA, includeFails: true },
    rlc: { mode: Mode.FRUITS, includeFails: true },
    recentlist: { includeFails: true },
    recentlisttaiko: { mode: Mode.TAIKO, includeFails: true },
    recentlistmania: { mode: Mode.MANIA, includeFails: true },
    recentlistcatch: { mode: Mode.FRUITS, includeFails: true },

    rlp: { includeFails: false },
    rlpt: { mode: Mode.TAIKO, includeFails: false },
    rlpm: { mode: Mode.MANIA, includeFails: false },
    rlpc: { mode: Mode.FRUITS, includeFails: false },
    recentlistpass: { includeFails: false },
    recentlistpasst: { mode: Mode.TAIKO, includeFails: false },
    recentlistpassm: { mode: Mode.MANIA, includeFails: false },
    recentlistpassc: { mode: Mode.FRUITS, includeFails: false },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let mode: Mode | undefined;
    let includeFails = true;

    if (ctx.isInteraction) {
        includeFails = !(ctx.interaction!.data.getBoolean("passes") ?? false);
    } else {
        const aliasConfig = modeAliases[ctx.commandName ?? "recentlist"];
        mode = aliasConfig?.mode;
        includeFails = aliasConfig?.includeFails ?? true;
    }

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, mode);
        validatePage(parsedArgs.page);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.respondError(error.message, "Check your input");
            return;
        }
        throw error;
    }

    const { user, mods, titleFilter } = parsedArgs;

    if (user.type === UserType.FAIL) {
        await ctx.respondError(user.failMessage, "Account not linked");
        return;
    }

    const { index } = parsedArgs;
    let { page } = parsedArgs;

    if (typeof page === "undefined" && typeof index === "undefined") page = 0;
    const isPage = typeof page !== "undefined";

    const { reply, embedOptions } = await getFetchedPlayReply({
        user,
        authorId: ctx.user.id,
        playType: PlayType.RECENT,
        index,
        page,
        isPage,
        includeFails,
        isMultiple: true,
        mods,
        titleFilter,
        emptyMessage: username =>
            `No \`${user.mode}\` plays found for \`${username}\` in the last 24 hours. A quiet day :3`,
    });
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

export const data: CommandData = {
    name: "recentlist",
    description: "Display a list of recent play(s) of a user.",
    hasPrefixVariant: true,
    application: {
        options: [
            usernameOption(),
            modeOption(),
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "index",
                description: "Specify an index, defaults to 1.",
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
            {
                type: ApplicationCommandOptionType.BOOLEAN,
                name: "passes",
                description: "Whether or not only passes should be considered.",
            },
            discordOption(),
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
};
