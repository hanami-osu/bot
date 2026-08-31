import { ppRequirementEmbed, userNotFoundEmbed } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { CommandData } from "@type/commands";
import { Mode, PlayType } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { CommandContext } from "@utils/command-context";
import {
    calculatePpRequirement,
    parsePpRequirementPrefixArgs,
    PpRequirementValidationError,
    validatePpRequirementInput,
    type PpRequirementInput,
} from "@utils/pp-requirement";
import { safeParse } from "@utils/safe-parse";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { ApplicationCommandOptionType } from "lilybird";
import { v2 } from "osu-api-extended";
import type { SuccessUser } from "@type/command-args";
import { UserType } from "@type/command-args";
import type { UserExtended } from "@type/osu";

const modeAliases: Record<string, Mode | undefined> = {
    pp: undefined,
    ppt: Mode.TAIKO,
    ppm: Mode.MANIA,
    ppc: Mode.FRUITS,
    ppctb: Mode.FRUITS,
    ppcatch: Mode.FRUITS,
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

    return modeAliases[commandName ?? "pp"];
}

function getRequirementInput(ctx: CommandContext): { input: PpRequirementInput; remainingArgs: Array<string> } {
    if (ctx.isInteraction) {
        const targetTotalPp = ctx.interaction?.data.getNumber("target");
        if (typeof targetTotalPp !== "number") throw new PpRequirementValidationError("Please provide a target pp value.");

        const playPp = ctx.interaction?.data.getNumber("play_pp") ?? undefined;
        const playCount = ctx.interaction?.data.getInteger("plays") ?? undefined;
        return { input: { targetTotalPp, playPp, playCount }, remainingArgs: [] };
    }

    return parsePpRequirementPrefixArgs(ctx.args);
}

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    let input: PpRequirementInput;
    let remainingArgs: Array<string>;
    try {
        ({ input, remainingArgs } = getRequirementInput(ctx));
        validatePpRequirementInput(input);
    } catch (error) {
        const message = error instanceof PpRequirementValidationError ? error.message : "The pp requirement could not be parsed.";
        await ctx.editReply(
            `${message}\nExamples: \`${ctx.prefix ?? "/"}pp 10000 mrekk\`, \`${ctx.prefix ?? "/"}pp 10000 500pp mrekk\`, \`${ctx.prefix ?? "/"}pp 10000 plays=5 mrekk\``,
        );
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

    const reply = await getEmbeds(user, input);
    await ctx.editReply(reply);
}

async function getEmbeds(user: SuccessUser, input: PpRequirementInput): Promise<MessageReplyOptions> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            embeds: [userNotFoundEmbed(user.banchoId)],
        };
    }

    const osuUser = osuUserRequest.data as UserExtended;
    const scores = await getUserScores(
        osuUser.id,
        PlayType.BEST,
        { query: { mode: user.mode, limit: USER_SCORE_FETCH_LIMIT } },
        user.authorDb,
    );
    const currentPlayPps = scores.map(score => score.pp).filter((pp): pp is number => typeof pp === "number");
    const result = calculatePpRequirement(osuUser.statistics.pp, currentPlayPps, input);

    return {
        embeds: [ppRequirementEmbed(osuUser, user.mode, result)],
    };
}

export const data = {
    name: "pp",
    description: "Calculate what pp plays a user needs to reach a target total pp.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "target",
                description: "Target total pp.",
                required: true,
                min_value: 1,
                max_value: 100000,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "play_pp",
                description: "Calculate how many plays of this pp value are needed.",
                min_value: 1,
                max_value: 100000,
            },
            {
                type: ApplicationCommandOptionType.INTEGER,
                name: "plays",
                description: "Calculate the pp value needed for this many plays.",
                min_value: 1,
                max_value: 100,
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
        aliases: Object.keys(modeAliases).filter(alias => alias !== "pp"),
    },
} satisfies CommandData;
