import { profileBuilder } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { ApplicationCommandOptionType, EmbedType } from "lilybird";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    let commandName = ctx.commandName;
    if (commandName === "profile") commandName = Mode.OSU;

    const { user } = (await parseCommandArgs(ctx, (commandName as Mode) ?? Mode.OSU));
    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const reply = await getEmbeds(user, ctx.user.id);
    await ctx.editReply(reply);
}

async function getEmbeds(user: SuccessUser, authorId: string): Promise<MessageReplyOptions> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            embeds: [
                {
                    type: EmbedType.Rich,
                    title: "Uh oh! :x:",
                    description: `It seems like the user **\`${user.banchoId}\`** doesn't exist! :(`,
                },
            ],
        };
    }
    const osuUser = osuUserRequest.data;

    const embeds = profileBuilder({
        type: EmbedBuilderType.PROFILE,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
    });

    return { embeds };
}

export const data = {
    name: "profile",
    description: "Display statistics of a user.",
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
                type: ApplicationCommandOptionType.USER,
                name: "discord",
                description: "Specify a linked Discord user",
            },
        ],
    },
    message: {
        aliases: ["osu", "mania", "taiko", "fruits"],
    },
} satisfies CommandData;
