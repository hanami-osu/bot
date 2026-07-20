import { bannerBuilder, userNotFoundEmbed } from "@builders";
import { EmbedBuilderType } from "@type/builders";
import { SuccessUser, UserType } from "@type/command-args";
import { CommandData } from "@type/commands";
import { parseCommandArgs } from "@utils/args";
import { userService } from "../../services/user-service";
import { ApplicationCommandOptionType } from "lilybird";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const { user } = await parseCommandArgs(ctx);

    if (user.type === UserType.FAIL) {
        await ctx.editReply(user.failMessage);
        return;
    }

    const embeds = await getEmbeds(user, ctx.user.id);
    await ctx.editReply({ embeds });
}

async function getEmbeds(user: SuccessUser, authorId: string) {
    const osuUser = await userService.getUser(user.banchoId, user.mode);
    if (!osuUser) {
        return [userNotFoundEmbed(user.banchoId)];
    }
    const embeds = bannerBuilder({
        type: EmbedBuilderType.BANNER,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
    });

    return embeds;
}

export const data = {
    name: "banner",
    description: "Display the banner of a user.",
    hasPrefixVariant: true,
    application: {
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "username",
                description: "Specify an osu! username",
            },
            {
                type: ApplicationCommandOptionType.USER,
                name: "discord",
                description: "Specify a linked Discord user",
            },
        ],
    },
} satisfies CommandData;
