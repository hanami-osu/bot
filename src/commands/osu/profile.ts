import { profileBuilder, userNotFoundEmbed } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { parseCommandArgs } from "@utils/args";
import { userService } from "../../services/user-service";
import { ApplicationCommandOptionType } from "lilybird";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const mode = ctx.isMessage && ctx.commandName !== "profile" ? (ctx.commandName as Mode) : undefined;
    const { user } = await parseCommandArgs(ctx, mode);
    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const reply = await getEmbeds(user, ctx.user.id);
    await ctx.editReply(reply);
}

async function getEmbeds(user: SuccessUser, authorId: string): Promise<MessageReplyOptions> {
    const osuUser = await userService.getUser(user.identity, user.mode);
    if (!osuUser) {
        return {
            embeds: [userNotFoundEmbed(user.identity.externalId)],
        };
    }
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
