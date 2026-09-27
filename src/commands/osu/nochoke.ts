import type { CommandData } from "@type/commands";
import { UserType } from "@type/command-args";
import { PlayType } from "@type/osu";
import { EmbedBuilderType, type NoChokePaginationOptions } from "@type/builders";
import { simpleErrorEmbed, simpleInfoEmbed } from "../../embed-builders/common";
import { buildNoChokePaginationMessageOptions } from "@services/nochoke-service";
import { CommandValidationError, parseCommandArgs, validatePage } from "@utils/args";
import { filterPlays } from "@utils/play-filters";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { calculateWeightedPp } from "@utils/whatif";
import { getPerformanceResults } from "@utils/osu";
import { safeParse } from "@utils/safe-parse";
import { v2 } from "osu-api-extended";
import { discordOption, filterOption, gradeOption, modeOption, modsActionOption, modsOption, usernameOption } from "./options";
import { ApplicationCommandOptionType } from "lilybird";
import { CommandContext } from "@utils/command-context";

const CALCULATION_BATCH_SIZE = 5;

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx);
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

    const userRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!userRequest.success) {
        await ctx.editReply({ embeds: [simpleErrorEmbed("I couldn't find that osu! user.", "Nothing to show")] });
        return;
    }

    const osuUser = userRequest.data;
    const scores = await getUserScores(
        osuUser.id,
        PlayType.BEST,
        { query: { mode: user.mode, limit: USER_SCORE_FETCH_LIMIT } },
        user.authorDb,
    );

    if (scores.length === 0) {
        await ctx.editReply({ embeds: [simpleInfoEmbed(`\`${osuUser.username}\` has no top plays to recalculate.`, "Nothing to show")] });
        return;
    }

    const filteredScores = filterPlays(scores, { mods, titleFilter, grade: parsedArgs.grade });
    if (filteredScores.length === 0) {
        await ctx.editReply({ embeds: [simpleInfoEmbed(`No top plays match the specified filters for \`${osuUser.username}\`.`, "Nothing to show")] });
        return;
    }

    const evaluatedScores: Array<{ currentPp: number; fcPp: number; index: number }> = [];
    for (let offset = 0; offset < filteredScores.length; offset += CALCULATION_BATCH_SIZE) {
        const batch = filteredScores.slice(offset, offset + CALCULATION_BATCH_SIZE);
        evaluatedScores.push(
            ...(await Promise.all(batch.map(async (score, batchOffset) => {
                const performance = await getPerformanceResults({
                    play: score,
                    mode: user.mode,
                    beatmapId: score.beatmap.id,
                    maxCombo: score.max_combo,
                    hitValues: score.statistics,
                    mods: score.mods,
                    passed: score.passed,
                    scoreData: user.authorDb?.score_data,
                });
                const currentPp = typeof score.pp === "number" ? score.pp : performance?.current.pp ?? 0;
                const fcPp = performance?.fc.pp ?? currentPp;

                return {
                    currentPp,
                    fcPp: Math.max(currentPp, fcPp),
                    index: offset + batchOffset,
                };
            }))),
        );
    }

    const currentTotalPp = osuUser.statistics.pp ?? 0;
    const currentWeightedPp = calculateWeightedPp(evaluatedScores.map(result => result.currentPp));
    const noChokeTotalPp = currentTotalPp + calculateWeightedPp(evaluatedScores.map(result => result.fcPp)) - currentWeightedPp;
    const gains = evaluatedScores
        .filter(result => result.fcPp > result.currentPp)
        .sort((first, second) => second.fcPp - second.currentPp - (first.fcPp - first.currentPp));

    if (gains.length === 0) {
        await ctx.editReply({ embeds: [simpleInfoEmbed("No top plays would gain pp from a full combo.", "Nothing to show")] });
        return;
    }

    const embedOptions: NoChokePaginationOptions = {
        type: EmbedBuilderType.NOCHOKE,
        initiatorId: ctx.user.id,
        user: osuUser,
        mode: user.mode,
        authorDb: user.authorDb,
        scores: filteredScores,
        gains,
        currentTotalPp,
        noChokeTotalPp,
        page: parsedArgs.page ?? 0,
    };

    const reply = await buildNoChokePaginationMessageOptions(embedOptions);
    await ctx.sendWithPagination(reply, embedOptions);
}

export const data: CommandData = {
    name: "nochoke",
    description: "Estimate your total pp if your top plays were full combos.",
    hasPrefixVariant: true,
    message: {
        aliases: ["nc"],
    },
    application: {
        options: [
            usernameOption(),
            modeOption(),
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
};
