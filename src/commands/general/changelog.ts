import type { CommandData } from "@type/commands";
import { CommandContext } from "@utils/command-context";
import { simpleInfoEmbed } from "../../embed-builders/common";

const CHANGELOG_URL = "https://github.com/hanami-osu/bot/commits/main";

export async function run(ctx: CommandContext): Promise<void> {
    await ctx.reply({
        embeds: [simpleInfoEmbed(`[View the latest changes to Hanami](<${CHANGELOG_URL}>)`, "Hanami changelog")],
    });
}

export const data = {
    name: "changelog",
    description: "See the latest changes to Hanami.",
    hasPrefixVariant: true,
} satisfies CommandData;
