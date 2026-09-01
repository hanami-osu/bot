import { bannerBuilder, userNotFoundEmbed } from "@builders";
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
            await ctx.editReply(error.message);
            return;
        }
        throw error;
    }

    const { user } = parsedArgs;

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
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

    const embeds = bannerBuilder({
        type: EmbedBuilderType.BANNER,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
    });

    return embeds;
}

export const data: CommandData = {
    name: "banner",
    description: "Display the banner of a user.",
    hasPrefixVariant: true,
    application: {
        options: [usernameOption(), discordOption()],
    },
};
