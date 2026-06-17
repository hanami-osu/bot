import { compareBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode, type Beatmap } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { getBeatmapIdFromContext } from "@utils/osu";
import { getBeatmapUserScores } from "@utils/score-api";
import { createPaginationActionRow } from "@utils/pagination";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";

const modeAliases: Record<string, { mode: Mode }> = {
    შედარება: { mode: Mode.OSU },
    mog: { mode: Mode.OSU },
    gap: { mode: Mode.OSU },
    c: { mode: Mode.OSU },
    compare: { mode: Mode.OSU },
    compareosu: { mode: Mode.OSU },
    comparetaiko: { mode: Mode.TAIKO },
    comparemania: { mode: Mode.MANIA },
    comparecatch: { mode: Mode.FRUITS },
};

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const mode = modeAliases[ctx.commandName ?? "compare"]?.mode ?? Mode.OSU;
    const { user, mods } = (await parseCommandArgs(ctx, mode));

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const { reply, embedOptions } = await getEmbeds(user, ctx.user.id, mods, ctx);
    if (embedOptions) {
        await ctx.sendWithPagination(reply, embedOptions);
    } else {
        await ctx.editReply(reply);
    }
}

async function getEmbeds(user: SuccessUser, authorId: string, mods: any, context: CommandContext): Promise<{ reply: MessageReplyOptions, embedOptions?: any }> {
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

    const beatmapId = user.beatmapId ?? (await getBeatmapIdFromContext(context.beatmapLookupContext));
    if (typeof beatmapId === "undefined" || beatmapId === null) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like the beatmap ID couldn't be found :(\n",
                    },
                ],
            }
        };
    }

    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: 'difficulty', id: Number(beatmapId) }));
    if (!beatmapRequest.success) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like this beatmap doesn't exist! :(",
                    },
                ],
            }
        };
    }
    const beatmap = beatmapRequest.data;

    if (beatmap.status === "pending" || beatmap.status === "wip" || beatmap.status === "graveyard") {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: "It seems like this beatmap's leaderboard doesn't exist! :(",
                    },
                ],
            }
        };
    }

    const plays = (await getBeatmapUserScores(beatmap.id, osuUser.id, { query: { mode: user.mode } }, user.authorDb)).sort((a: any, b: any) => b.pp - a.pp);

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [
                    {
                        type: EmbedType.Rich,
                        title: "Uh oh! :x:",
                        description: `It seems like \`${osuUser.username}\` has no plays on that beatmap!`,
                    },
                ],
            }
        };
    }

    const embedOptions = {
        type: EmbedBuilderType.COMPARE as EmbedBuilderType.COMPARE,
        initiatorId: authorId,
        mode: user.mode,
        user: osuUser,
        beatmap: beatmap as Beatmap,
        plays,
        mods,
        page: 0,
    };

    const embeds = await compareBuilder(embedOptions);
    return {
        reply: {
            embeds,
            components: createPaginationActionRow(embedOptions),
        },
        embedOptions,
    };
}

export const data = {
    name: "compare",
    description: "Display play(s) of a user on a beatmap.",
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
                name: "map",
                description: "Specify a beatmap link (eg: https://osu.ppy.sh/b/72727)",
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
