import { userNotFoundEmbed, whatIfBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { CommandData } from "@type/commands";
import { EmbedBuilderType } from "@type/builders";
import { Mode, PlayType } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { CommandContext } from "@utils/command-context";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { safeParse } from "@utils/safe-parse";
import { calculateWhatIfProjection, estimateGlobalRankFromPp, extractWhatIfPlayPps, parseWhatIfPlayPps, WhatIfValidationError } from "@utils/whatif";
import { ApplicationCommandOptionType } from "lilybird";
import { v2 } from "osu-api-extended";
import type { SuccessUser } from "@type/command-args";
import { UserType } from "@type/command-args";
import type { UserExtended } from "@type/osu";

const modeAliases: Record<string, Mode | undefined> = {
    wi: undefined,
    wit: Mode.TAIKO,
    wim: Mode.MANIA,
    wic: Mode.FRUITS,
    whatif: undefined,
    whatift: Mode.TAIKO,
    whatiftaiko: Mode.TAIKO,
    whatifm: Mode.MANIA,
    whatifmania: Mode.MANIA,
    whatifc: Mode.FRUITS,
    whatifcatch: Mode.FRUITS,
    whatifctb: Mode.FRUITS,
};

const modeFlagAliases: Record<string, Mode> = {
    osu: Mode.OSU,
    mania: Mode.MANIA,
    taiko: Mode.TAIKO,
    fruits: Mode.FRUITS,
    catch: Mode.FRUITS,
    ctb: Mode.FRUITS,
};

function getPrefixMode(commandName: string | undefined, args: Array<string>): Mode | undefined {
    for (const arg of args) {
        const [, modeValue] = /^mode=(osu|mania|taiko|fruits|catch|ctb)$/i.exec(arg) ?? [];
        if (modeValue) return modeFlagAliases[modeValue.toLowerCase()];
    }

    return modeAliases[commandName ?? "whatif"];
}

function getWhatIfValues(ctx: CommandContext): { playPps: Array<number>; remainingArgs: Array<string> } {
    if (ctx.isInteraction) {
        const plays = ctx.interaction?.data.getString("plays") ?? "";
        return { playPps: parseWhatIfPlayPps(plays), remainingArgs: [] };
    }

    return extractWhatIfPlayPps(ctx.args);
}

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let playPps: Array<number>;
    let remainingArgs: Array<string>;
    try {
        ({ playPps, remainingArgs } = getWhatIfValues(ctx));
        if (playPps.length === 0) throw new WhatIfValidationError("Please provide at least one pp value.");
    } catch (error) {
        const message = error instanceof WhatIfValidationError ? error.message : "The pp values could not be parsed.";
        await ctx.editReply(`${message}\nExample: \`${ctx.prefix ?? "/"}whatif 500 480 mrekk\``);
        return;
    }

    const mode = ctx.isMessage ? getPrefixMode(ctx.commandName, remainingArgs) : undefined;
    const parseCtx = ctx.isMessage
        ? new CommandContext(ctx.client, undefined, ctx.message, remainingArgs, ctx.prefix, ctx.commandName, ctx.channel, ctx.index)
        : ctx;
    const { user } = await parseCommandArgs(parseCtx, mode);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const reply = await getEmbeds(user, playPps, ctx.user.id);
    await ctx.editReply(reply);
}

async function getEmbeds(user: SuccessUser, playPps: Array<number>, initiatorId: string): Promise<MessageReplyOptions> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            embeds: [userNotFoundEmbed(user.banchoId)],
        };
    }

    const osuUser = osuUserRequest.data as UserExtended;
    const scores = await getUserScores(osuUser.id, PlayType.BEST, { query: { mode: user.mode, limit: USER_SCORE_FETCH_LIMIT } }, user.authorDb);
    const currentPlayPps = scores.map((score) => score.pp).filter((pp): pp is number => typeof pp === "number");
    const currentTotalPp = osuUser.statistics.pp;
    const projection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, playPps);
    const projectedRank =
        projection.ppGain < 0.005 ? osuUser.statistics.global_rank : await estimateGlobalRankFromPp(projection.projectedTotalPp, user.mode);

    return {
        embeds: whatIfBuilder({
            type: EmbedBuilderType.WHATIF,
            initiatorId,
            user: osuUser,
            mode: user.mode,
            projection,
            projectedRank,
        }),
    };
}

export const data = {
    name: "whatif",
    description: "Calculate the pp and rank a user would reach with hypothetical pp plays.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "plays",
                description: "One or more pp values, separated by spaces or commas.",
                required: true,
            },
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
                type: ApplicationCommandOptionType.USER,
                name: "discord",
                description: "Specify a linked Discord user",
            },
        ],
    },
    message: {
        aliases: Object.keys(modeAliases).filter((alias) => alias !== "whatif"),
    },
} satisfies CommandData;
