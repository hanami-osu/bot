import { playBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { createPaginationActionRow } from "@utils/pagination";
import { getUserScores } from "@utils/score-api";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";
import type { PlaysBuilderOptions } from "@type/builders";

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

    const { user, mods, flags } = (await parseCommandArgs(ctx, mode));

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    let index = ctx.isInteraction ? ctx.interaction!.data.getInteger("index") : ctx.index;
    let page = ctx.isInteraction ? ctx.interaction!.data.getInteger("page") : (Number(flags.p ?? flags.page) || undefined);

    if (typeof page === "undefined" && typeof index === "undefined") {
        page = ctx.isMessage ? 0 : 1;
    }

    if (page && ctx.isInteraction) page -= 1;
    if (page && ctx.isMessage) page -= 1; // Standardize to 0-based
    if (ctx.isMessage && typeof flags.p !== "undefined") page = Number(flags.p) - 1;
    if (ctx.isMessage && typeof flags.page !== "undefined") page = Number(flags.page) - 1;
    if (index && ctx.isInteraction) index -= 1;
    
    if (typeof page === "undefined" && typeof index === "undefined") page = 0;
    const isPage = typeof page !== "undefined";

    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, index, page, isPage, mods, includeFails);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(user: SuccessUser, authorId: string, index: number | undefined, page: number | undefined, isPage: boolean, mods: any, includeFails: boolean): Promise<{ reply: MessageReplyOptions, embedOptions?: PlaysBuilderOptions }> {
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
            }
        };
    }
    const osuUser = osuUserRequest.data;

    const plays = await getUserScores(osuUser.id, PlayType.RECENT, { query: { mode: user.mode, limit: 200, include_fails: includeFails } }, user.authorDb);

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: `It seems like \`${osuUser.username}\` hasn't had any recent plays in the last 24 hours!`,
                    },
                ],
            }
        };
    }

    const embedOptions: PlaysBuilderOptions = {
        type: EmbedBuilderType.PLAYS,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
        isMultiple: true,
        authorDb: user.authorDb,
        isPage,
        page,
        index,
        mods,
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

export const data = {
    name: "recentlist",
    description: "Display a list of recent play(s) of a user.",
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
                max_value: 200,
            },
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "page",
                description: "Specify a page, defaults to 1.",
                min_value: 1,
                max_value: 20,
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
