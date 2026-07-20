import { simpleErrorEmbed, simulateBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "../../discord/beatmap-context";
import { ApplicationCommandOptionType } from "lilybird";

import { CommandContext } from "@utils/command-context";
import type { DifficultyOptions } from "@type/command-args";
import type { Mod } from "@type/mods";

interface SimulationOptions {
    mods: Array<string> | Array<Mod> | null;
    options: DifficultyOptions;
}

export async function run(ctx: CommandContext) {
    await ctx.defer();
    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, Mode.OSU);
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.editReply({
                embeds: [simpleErrorEmbed(error.message, "Invalid simulation input")],
            });
            return;
        }
        throw error;
    }

    const { user, mods, flags } = parsedArgs;

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(ctx.beatmapLookupContext));
    if (!beatmapId) {
        await ctx.editReply({
            embeds: [simpleErrorEmbed("It seems like the beatmap ID couldn't be found :(\n")],
        });
        return;
    }

    let simulationOptions: SimulationOptions;
    try {
        simulationOptions =
            ctx.isInteraction && ctx.interaction
                ? {
                      mods: splitMods(ctx.interaction.data.getString("mods")),
                      options: {
                          combo: optionalInteger(ctx.interaction.data.getNumber("combo"), "combo"),
                          acc: optionalRange(ctx.interaction.data.getNumber("acc"), "accuracy", 0, 100),
                          clock_rate: optionalPositiveNumber(ctx.interaction.data.getNumber("clock_rate"), "clock rate"),
                          bpm: optionalPositiveNumber(ctx.interaction.data.getNumber("bpm"), "BPM"),
                      },
                  }
                : {
                      mods: splitMods(typeof mods.name === "string" ? mods.name : null),
                      options: {
                          combo: optionalInteger(flags.combo, "combo"),
                          acc: optionalRange(flags.acc ?? flags.accuracy, "accuracy", 0, 100),
                          clock_rate: optionalPositiveNumber(flags.clock_rate ?? flags.clockrate, "clock rate"),
                          bpm: optionalPositiveNumber(flags.bpm, "BPM"),
                      },
                  };
    } catch (error) {
        if (error instanceof CommandValidationError) {
            await ctx.editReply({
                embeds: [simpleErrorEmbed(error.message, "Invalid simulation input")],
            });
            return;
        }
        throw error;
    }

    const reply = await getEmbeds(String(beatmapId), ctx.user.id, simulationOptions);
    await ctx.editReply(reply);
}

function optionalNumber(value: number | string | null | undefined, label: string): number | undefined {
    if (value === null || typeof value === "undefined" || value === "") return undefined;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) throw new CommandValidationError(`${label} must be a finite number.`);
    return number;
}

function optionalPositiveNumber(value: number | string | null | undefined, label: string): number | undefined {
    const number = optionalNumber(value, label);
    if (typeof number === "undefined") return undefined;
    if (number <= 0) throw new CommandValidationError(`${label} must be greater than zero.`);
    return number;
}

function optionalRange(value: number | string | null | undefined, label: string, min: number, max: number): number | undefined {
    const number = optionalNumber(value, label);
    if (typeof number === "undefined") return undefined;
    if (number < min || number > max) throw new CommandValidationError(`${label} must be between ${min} and ${max}.`);
    return number;
}

function optionalInteger(value: number | string | null | undefined, label: string): number | undefined {
    const number = optionalNumber(value, label);
    if (typeof number === "undefined") return undefined;
    if (!Number.isInteger(number) || number < 0) throw new CommandValidationError(`${label} must be a non-negative integer.`);
    return number;
}

function splitMods(mods: string | null | undefined): Array<string> | null {
    if (!mods || mods.toUpperCase() === "NM") return null;
    return mods.toUpperCase().match(/.{1,2}/g) ?? null;
}

async function getEmbeds(beatmapId: string, authorId: string, simulationOptions: SimulationOptions): Promise<MessageReplyOptions> {
    const embeds = await simulateBuilder({
        type: EmbedBuilderType.SIMULATE,
        initiatorId: authorId,
        beatmapId: Number(beatmapId),
        mods: simulationOptions.mods,
        options: simulationOptions.options,
    });

    return { embeds };
}

export const data = {
    name: "simulate",
    description: "Simulate a score on a beatmap.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "map",
                description: "Specify a beatmap link (eg: https://osu.ppy.sh/b/72727)",
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mods",
                description: "Specify a mods combination.",
                min_length: 2,
            },
            {
                type: ApplicationCommandOptionType.STRING,
                name: "mode",
                description: "Specify a gamemode.",
                choices: [
                    { name: "osu", value: "osu" },
                    { name: "mania", value: "mania" },
                    { name: "taiko", value: "taiko" },
                    { name: "ctb", value: "fruits" },
                ],
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "combo",
                description: "Specify a combo.",
                min_value: 0,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "acc",
                description: "Specify an accuracy.",
                min_value: 0,
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "clock_rate",
                description: "Specify a custom clockrate that overwrites any other rate changes.",
            },
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "bpm",
                description: "Specify a custom BPM.",
            },
        ],
    },
    message: {
        aliases: ["s", "sim"],
    },
} satisfies CommandData;
