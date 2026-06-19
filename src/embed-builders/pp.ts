import { Mode, type UserExtended } from "@type/osu";
import type { PpRequirementResult } from "@utils/pp-requirement";
import { EmbedType, type Embed } from "lilybird";

export function ppRequirementEmbed(user: UserExtended, mode: Mode, result: PpRequirementResult): Embed.Structure {
    const currentTotalPp = user.statistics.pp;
    const currentRank = user.statistics.global_rank;
    const userUrl = `https://osu.ppy.sh/users/${user.id}/${mode}`;
    const flagUrl = `https://osu.ppy.sh/images/flags/${user.country_code}.png`;
    const author = {
        name: `${user.username}: ${formatPp(currentTotalPp)}pp (${formatRank(currentRank)})`,
        icon_url: flagUrl,
        url: userUrl,
    };

    if (result.kind === "already_reached") {
        return {
            type: EmbedType.Rich,
            author,
            description: `**${user.username}** already has **${formatPp(result.currentTotalPp)}pp**, which meets the **${formatPp(result.targetTotalPp)}pp** target.`,
            thumbnail: { url: user.avatar_url },
        };
    }

    if (result.kind === "unreachable") {
        const limitText = typeof result.playPp === "number" ? `with up to 100 **${formatPp(result.playPp)}pp** plays` : `with ${result.playCount} ${pluralizePlay(result.playCount ?? 0)} up to 100,000.00pp`;

        return {
            type: EmbedType.Rich,
            author,
            description: `**${user.username}** cannot reach **${formatPp(result.targetTotalPp)}pp** ${limitText}.`,
            fields: [
                {
                    name: "Highest projection",
                    value: `\`${formatPp(result.maxProjection.projectedTotalPp)}pp\` (+\`${formatPp(result.maxProjection.ppGain)}pp\`)`,
                    inline: true,
                },
                {
                    name: "Current",
                    value: `\`${formatPp(currentTotalPp)}pp\``,
                    inline: true,
                },
            ],
            thumbnail: { url: user.avatar_url },
        };
    }

    const resultText =
        result.kind === "required_play_count"
            ? `**${result.playCount}** ${pluralizePlay(result.playCount)} worth **${formatPp(result.playPp)}pp** each`
            : `**${result.playCount}** ${pluralizePlay(result.playCount)} worth **${formatPp(result.requiredPlayPp)}pp** each`;

    return {
        type: EmbedType.Rich,
        author,
        description: `To reach **${formatPp(result.targetTotalPp)}pp**, **${user.username}** needs ${resultText}.`,
        fields: [
            {
                name: "Projected",
                value: `\`${formatPp(result.projection.projectedTotalPp)}pp\` (+\`${formatPp(result.projection.ppGain)}pp\`)`,
                inline: true,
            },
            {
                name: "Current",
                value: `\`${formatPp(currentTotalPp)}pp\``,
                inline: true,
            },
            {
                name: "Bonus PP",
                value: `Preserved at \`${formatPp(result.projection.currentBonusPp)}pp\``,
                inline: true,
            },
        ],
        footer: { text: "Assumes new plays are added as equal pp scores." },
        thumbnail: { url: user.avatar_url },
    };
}

function formatPp(pp: number): string {
    return pp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRank(rank: number | null | undefined): string {
    return rank ? `#${rank.toLocaleString()}` : "#-";
}

function pluralizePlay(count: number): string {
    return count === 1 ? "play" : "plays";
}
