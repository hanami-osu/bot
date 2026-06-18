import { playBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { createPaginationActionRow } from "@utils/pagination";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";
import type { PlaysBuilderOptions } from "@type/builders";

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

    const { user, mods } = await parseCommandArgs(ctx, mode);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, index, includeFails, mods);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(user: SuccessUser, authorId: string, index: number, includeFails: boolean, mods: any): Promise<{ reply: MessageReplyOptions; embedOptions?: PlaysBuilderOptions }> {
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

    const plays = await getUserScores(osuUser.id, PlayType.RECENT, { query: { mode: user.mode, limit: USER_SCORE_FETCH_LIMIT, include_fails: includeFails } }, user.authorDb);

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: `It seems like \`${osuUser.username}\` hasn't set any recent plays! :(`,
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
        authorDb: user.authorDb,
        plays,
        index,
        isPage: false,
        mods,
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

export const data = {
    name: "recent",
    description: "Display recent play(s) of a user.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "username",
                description: "Specify an osu! username",
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mode",
                description: "Specify an osu! mode",
                choices: [
                    { name: "osu", value: "osu" },
                    { name: "mania", value: "mania" },
                    { name: "taiko", value: "taiko" },
                    { name: "ctb", value: "fruits" },
                ],
            },
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "index",
                description: "Specify an index, defaults to 1.",
                min_value: 1,
                max_value: USER_SCORE_FETCH_LIMIT,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mods",
                description: "Specify a mods combination.",
                min_length: 2,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mods_action",
                description: "Specify the action to perform on the mods combination.",
                choices: [
                    {
                        name: "Include",
                        value: "include",
                    },
                    {
                        name: "Force Include",
                        value: "force_include",
                    },
                    {
                        name: "Exclude",
                        value: "exclude",
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "grade",
                description: "Consider scores only with this grade.",
                choices: ["SS", "S", "A", "B", "C", "D"].map((grade) => ({ name: grade, value: grade })),
            },
            {
                type: ApplicationCommandOptionType.BOOLEAN,
                name: "passes",
                description: "Whether or not only passes should be considered.",
            },
            {
                type: ApplicationCommandOptionType.USER,
                name: "discord",
                description: "Specify a linked Discord user",
            },
        ],
    },
    message: {
        aliases: Object.keys(modeAliases),
    },
} satisfies CommandData;
