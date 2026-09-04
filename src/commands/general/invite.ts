import { CommandData } from "@type/commands";
import { BOT_INVITE_URL, BOT_VOTE_URL } from "@utils/constants";
import { CommandContext } from "@utils/command-context";
import { simpleInfoEmbed } from "../../embed-builders/common";

const inviteString = `[Invite Hanami to your server](${BOT_INVITE_URL})\n[Vote for Hanami on top.gg](${BOT_VOTE_URL})`;

export async function run(ctx: CommandContext) {
    await ctx.reply({ embeds: [simpleInfoEmbed(inviteString, "Invite Hanami")] });
}

export const data = {
    name: "invite",
    description: "Get an invite link of the bot.",
    hasPrefixVariant: true,
} satisfies CommandData;
