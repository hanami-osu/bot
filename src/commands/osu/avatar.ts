import { avatarBuilder, userNotFoundEmbed } from "@builders";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { CommandValidationError, parseCommandArgs } from "@utils/args";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { CommandContext } from "@utils/command-context";
import { discordOption, usernameOption } from "./options";

export async function run(ctx: CommandContext) {
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

    const embeds = await getEmbeds(user, ctx.user.id);
    await ctx.editReply({ embeds });
}

async function getEmbeds(user: SuccessUser, authorId: string) {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return [userNotFoundEmbed(user.banchoId)];
    }
    const osuUser = osuUserRequest.data;

    const embeds = avatarBuilder({
        type: EmbedBuilderType.AVATAR,
        initiatorId: authorId,
        user: osuUser,
    });

    return embeds;
}

export const data: CommandData = {
    name: "avatar",
    description: "Display the profile of a user.",
    hasPrefixVariant: true,
    application: {
        options: [usernameOption(), discordOption()],
    },
};
