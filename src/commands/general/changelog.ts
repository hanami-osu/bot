import type { CommandData } from "@type/commands";
import { CommandContext } from "@utils/command-context";
import { simpleInfoEmbed } from "../../embed-builders/common";

const RELEASES_URL = "https://github.com/hanami-osu/bot/releases";
const LATEST_RELEASE_URL = "https://api.github.com/repos/hanami-osu/bot/releases/latest";

interface Release {
    name: string | null;
    tag_name: string;
    body: string | null;
    html_url: string;
}

export async function run(ctx: CommandContext): Promise<void> {
    if (ctx.isInteraction) await ctx.defer();

    let description: string;
    try {
        const response = await fetch(LATEST_RELEASE_URL, {
            headers: { "Accept": "application/vnd.github+json", "User-Agent": "Hanami-Bot" },
            signal: AbortSignal.timeout(5000),
        });

        if (response.status === 404) {
            description = `No releases have been published yet. [View releases](<${RELEASES_URL}>).`;
        } else {
            if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

            const release = await response.json() as Release;
            if (!release.tag_name || !release.html_url) throw new Error("GitHub returned an invalid release");

            const notes = release.body?.trim() || "No release notes provided.";
            const excerpt = notes.length > 3500 ? `${notes.slice(0, 3497)}...` : notes;
            description = `**${release.name || release.tag_name}**\n\n${excerpt}\n\n[View full release](<${release.html_url}>)`;
        }
    } catch {
        description = `Couldn't load the latest release right now. [View releases](<${RELEASES_URL}>).`;
    }

    await ctx.reply({
        embeds: [simpleInfoEmbed(description, "Hanami changelog")],
    });
}

export const data = {
    name: "changelog",
    description: "See the latest changes to Hanami.",
    hasPrefixVariant: true,
} satisfies CommandData;
