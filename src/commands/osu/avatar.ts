import { avatarBuilder } from "@builders";
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
    const { user } = await parseCommandArgs(ctx, Mode.OSU);

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
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: `It seems like the user **\`${user.banchoId}\`** doesn't exist! :(`,
            },
        ];
    }
    const osuUser = osuUserRequest.data;

    const embeds = avatarBuilder({
        type: EmbedBuilderType.AVATAR,
        initiatorId: authorId,
        user: osuUser,
    });

    return embeds;
}

export const data = {
    name: "avatar",
    description: "Display the profile of a user.",
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
