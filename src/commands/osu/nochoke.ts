import type { CommandData } from "@type/commands";
import { UserType } from "@type/command-args";
import { PlayType, type Score } from "@type/osu";
import { simpleErrorEmbed, simpleInfoEmbed } from "../../embed-builders/common";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { getUserScores } from "@utils/score-api";
import { calculateWeightedPp } from "@utils/whatif";
import { getPerformanceResults } from "@utils/osu";
import { safeParse } from "@utils/safe-parse";
import { v2 } from "osu-api-extended";
import { discordOption, modeOption, usernameOption } from "./options";
import { CommandContext } from "@utils/command-context";

const TOP_SCORE_LIMIT = 100;
const DISPLAY_SCORE_LIMIT = 5;
const CALCULATION_BATCH_SIZE = 5;

interface NoChokeScore {
    score: Score;
    currentPp: number;
    fcPp: number;
    calculated: boolean;
}

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.defer();

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.respondError(error.message, "Check your input");
            return;
        }
        throw error;
    }

    const { user } = parsedArgs;
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
        { query: { mode: user.mode, limit: TOP_SCORE_LIMIT } },
        user.authorDb,
    );

    if (scores.length === 0) {
        await ctx.editReply({ embeds: [simpleInfoEmbed(`\`${osuUser.username}\` has no top plays to recalculate.`, "Nothing to show")] });
        return;
    }

    const evaluatedScores: Array<NoChokeScore> = [];
    for (let offset = 0; offset < scores.length; offset += CALCULATION_BATCH_SIZE) {
        const batch = scores.slice(offset, offset + CALCULATION_BATCH_SIZE);
        evaluatedScores.push(
            ...(await Promise.all(batch.map(async (score) => {
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
                    score,
                    currentPp,
                    fcPp: Math.max(currentPp, fcPp),
                    calculated: performance !== null,
                };
            }))),
        );
    }

    const currentTotalPp = osuUser.statistics.pp ?? 0;
    const currentWeightedPp = calculateWeightedPp(evaluatedScores.map(result => result.currentPp));
    const bonusPp = Math.max(0, currentTotalPp - currentWeightedPp);
    const noChokeTotalPp = calculateWeightedPp(evaluatedScores.map(result => result.fcPp)) + bonusPp;
    const gains = evaluatedScores
        .filter(result => result.fcPp > result.currentPp)
        .sort((first, second) => second.fcPp - second.currentPp - (first.fcPp - first.currentPp))
        .slice(0, DISPLAY_SCORE_LIMIT);

    const lines = [
        `**Current total:** ${currentTotalPp.toFixed(2)}pp`,
        `**No-choke top ${scores.length}:** ${noChokeTotalPp.toFixed(2)}pp (+${(noChokeTotalPp - currentTotalPp).toFixed(2)}pp)`,
        ...gains.map(({ score, currentPp, fcPp }) =>
            `**#${score.position}** ${score.beatmapset.artist} - ${score.beatmapset.title} [${score.beatmap.version}]: ${currentPp.toFixed(2)} → ${fcPp.toFixed(2)}pp (+${(fcPp - currentPp).toFixed(2)}pp)`,
        ),
    ];
    const unavailableCount = evaluatedScores.filter(result => !result.calculated).length;
    if (unavailableCount > 0) {
        lines.push(`Could not recalculate ${unavailableCount} beatmap${unavailableCount === 1 ? "" : "s"}; their current pp was kept.`);
    }

    await ctx.editReply({ embeds: [simpleInfoEmbed(lines.join("\n"), `${osuUser.username}'s no-choke estimate`)] });
}

export const data: CommandData = {
    name: "nochoke",
    description: "Estimate your total pp if your top plays were full combos.",
    hasPrefixVariant: true,
    message: {
        aliases: ["nc"],
    },
    application: {
        options: [usernameOption(), modeOption(), discordOption()],
    },
};
