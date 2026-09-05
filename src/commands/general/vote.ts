import { CommandData } from "@type/commands";
import { BOT_VOTE_URL } from "@utils/constants";
import { simpleInfoEmbed } from "../../embed-builders/common";

const voteString = `[Vote for Hanami on top.gg](${BOT_VOTE_URL})\nThanks for helping more osu! players find me :3`;

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.reply({ embeds: [simpleInfoEmbed(voteString, "Vote for Hanami")] });
}

export const data = {
    name: "vote",
    description: "Vote for the bot.",
    hasPrefixVariant: true,
} satisfies CommandData;
