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

const modeAliases: Record<string, { mode: Mode }> = {
    t: { mode: Mode.OSU },
    top: { mode: Mode.OSU },
    topt: { mode: Mode.TAIKO },
    topm: { mode: Mode.MANIA },
    topc: { mode: Mode.FRUITS },
    toptaiko: { mode: Mode.TAIKO },
    topmania: { mode: Mode.MANIA },
    topcatch: { mode: Mode.FRUITS },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const mode = modeAliases[ctx.commandName ?? "top"]?.mode ?? Mode.OSU;
    const { user, mods, flags } = await parseCommandArgs(ctx, mode);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    let index = ctx.isInteraction ? ctx.interaction!.data.getInteger("index") : ctx.index;
    let page = ctx.isInteraction ? ctx.interaction!.data.getInteger("page") : Number(flags.p ?? flags.page) || undefined;

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

    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, index, page, isPage, mods);
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

    const plays = await getUserScores(osuUser.id, PlayType.BEST, { query: { mode: user.mode, limit: 200 } }, user.authorDb);

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
    name: "top",
    description: "Display top play(s) of a user.",
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
                description: "Specify an index.",
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
