import { UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { getFetchedPlayReply } from "@services/play-service";
import { CommandValidationError, parseCommandArgs, parsePrefixPageFlag } from "@utils/args";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { ApplicationCommandOptionType } from "lilybird";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode: Mode; includeFails: boolean }> = {
    rl: { mode: Mode.OSU, includeFails: true },
    rlt: { mode: Mode.TAIKO, includeFails: true },
    rlm: { mode: Mode.MANIA, includeFails: true },
    rlc: { mode: Mode.FRUITS, includeFails: true },
    recentlist: { mode: Mode.OSU, includeFails: true },
    recentlisttaiko: { mode: Mode.TAIKO, includeFails: true },
    recentlistmania: { mode: Mode.MANIA, includeFails: true },
    recentlistcatch: { mode: Mode.FRUITS, includeFails: true },

    rlp: { mode: Mode.OSU, includeFails: false },
    rlpt: { mode: Mode.TAIKO, includeFails: false },
    rlpm: { mode: Mode.MANIA, includeFails: false },
    rlpc: { mode: Mode.FRUITS, includeFails: false },
    recentlistpass: { mode: Mode.OSU, includeFails: false },
    recentlistpasst: { mode: Mode.TAIKO, includeFails: false },
    recentlistpassm: { mode: Mode.MANIA, includeFails: false },
    recentlistpassc: { mode: Mode.FRUITS, includeFails: false },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let mode = Mode.OSU;
    let includeFails = true;

    if (ctx.isInteraction) {
        includeFails = !(ctx.interaction!.data.getBoolean("passes") ?? false);
    } else {
        const aliasConfig = modeAliases[ctx.commandName ?? "recentlist"];
        mode = aliasConfig?.mode ?? Mode.OSU;
        includeFails = aliasConfig?.includeFails ?? true;
    }

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

    if (typeof page === "undefined" && typeof index === "undefined") page = 0;
    const isPage = typeof page !== "undefined";

    const titleFilter = flags.filter?.trim() || undefined;
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
        emptyMessage: (username) => `It seems like \`${username}\` hasn't had any recent plays in the last 24 hours!`,
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
