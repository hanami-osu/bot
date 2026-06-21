import { UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { getFetchedPlayReply } from "@services/play-service";
import { parseCommandArgs } from "@utils/args";
import { USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { ApplicationCommandOptionType } from "lilybird";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";

const modeAliases: Record<string, { mode: Mode; includeFails: boolean }> = {
    r: { mode: Mode.OSU, includeFails: true },
    rs: { mode: Mode.OSU, includeFails: true },
    rt: { mode: Mode.TAIKO, includeFails: true },
    rm: { mode: Mode.MANIA, includeFails: true },
    rc: { mode: Mode.FRUITS, includeFails: true },
    recent: { mode: Mode.OSU, includeFails: true },
    recenttaiko: { mode: Mode.TAIKO, includeFails: true },
    recentmania: { mode: Mode.MANIA, includeFails: true },
    recentcatch: { mode: Mode.FRUITS, includeFails: true },

    rp: { mode: Mode.OSU, includeFails: false },
    rsp: { mode: Mode.OSU, includeFails: false },
    rpt: { mode: Mode.TAIKO, includeFails: false },
    rpm: { mode: Mode.MANIA, includeFails: false },
    rpc: { mode: Mode.FRUITS, includeFails: false },
    recentpass: { mode: Mode.OSU, includeFails: false },
    recentpasstaiko: { mode: Mode.TAIKO, includeFails: false },
    recentpassmania: { mode: Mode.MANIA, includeFails: false },
    recentpasscatch: { mode: Mode.FRUITS, includeFails: false },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let mode = Mode.OSU;
    let includeFails = true;
    let index = 0;

    if (ctx.isInteraction) {
        includeFails = !(ctx.interaction!.data.getBoolean("passes") ?? false);
        index = (ctx.interaction!.data.getInteger("index") ?? 1) - 1;
    } else {
        const aliasConfig = modeAliases[ctx.commandName ?? "recent"];
        mode = aliasConfig?.mode ?? Mode.OSU;
        includeFails = aliasConfig?.includeFails ?? true;
        index = ctx.index ?? 0;
    }

    const { user, mods, flags } = await parseCommandArgs(ctx, mode);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const titleFilter = flags.filter?.trim() || undefined;
    const { reply, embedOptions } = await getFetchedPlayReply({
        user,
        authorId: ctx.user.id,
        playType: PlayType.RECENT,
        index,
        isPage: false,
        includeFails,
        mods,
        titleFilter,
        emptyMessage: (username) => `It seems like \`${username}\` hasn't set any recent plays! :(`,
    });
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

export const data: CommandData = {
    name: "recent",
    description: "Display recent play(s) of a user.",
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
