import { profileBuilder, userNotFoundEmbed } from "@builders";
import { MessageReplyOptions } from "@lilybird/transformers";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { Mode } from "@type/osu";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { CommandContext } from "@utils/command-context";
import { discordOption, modeOption, usernameOption } from "./options";

export async function run(ctx: CommandContext) {
    await ctx.defer();

    const mode = ctx.isMessage && ctx.commandName !== "profile" ? (ctx.commandName as Mode) : undefined;

    let parsedArgs: Awaited<ReturnType<typeof parseCommandArgs>>;
    try {
        parsedArgs = await parseCommandArgs(ctx, mode);
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

    const reply = await getEmbeds(user, ctx.user.id);
    await ctx.editReply(reply);
}

async function getEmbeds(user: SuccessUser, authorId: string): Promise<MessageReplyOptions> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            embeds: [userNotFoundEmbed(user.banchoId)],
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

export const data: CommandData = {
    name: "profile",
    description: "Display statistics of a user.",
    hasPrefixVariant: true,
    application: {
        options: [usernameOption(), modeOption(), discordOption()],
    },
    message: {
        aliases: ["osu", "mania", "taiko", "fruits"],
    },
};
