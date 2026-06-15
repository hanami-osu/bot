import { CommandData } from "@type/commands";
import { BOT_INVITE_URL, BOT_VOTE_URL } from "@utils/constants";
import { CommandContext } from "@utils/command-context";

const inviteString = `You can invite the bot to your server using the following link:\n${BOT_INVITE_URL}\nYou can also vote for the bot:\n${BOT_VOTE_URL}`;

export async function run(ctx: CommandContext) {
    await ctx.reply(inviteString);
}

export const data = {
    name: "invite",
    description: "Get an invite link of the bot.",
    hasPrefixVariant: true,
} satisfies CommandData;
