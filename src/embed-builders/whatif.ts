import { EmbedType } from "lilybird";
import type { WhatIfBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";

function formatPp(pp: number): string {
    return pp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRank(rank: number | null | undefined): string {
    return rank ? `#${rank.toLocaleString()}` : "#-";
}

function formatCountryRank(countryCode: string | undefined, countryRank: number | null | undefined): string {
    if (!countryCode) return "";
    return ` ${countryCode}#${countryRank?.toLocaleString() ?? "-"}`;
}

export function whatIfBuilder({ user, mode, projection, projectedRank }: WhatIfBuilderOptions): Array<Embed.Structure> {
    const currentTotalPp = user.statistics.pp;
    const currentRank = user.statistics.global_rank;
    const countryRank = user.statistics.country_rank;
    const doesNotAffectTotal = projection.ppGain < 0.005;
    const rankDifference = projectedRank && currentRank ? currentRank - projectedRank : null;
    const rankGain = rankDifference && rankDifference > 0 ? ` (+${rankDifference.toLocaleString()})` : "";
    const userUrl = `https://osu.ppy.sh/users/${user.id}/${mode}`;
    const flagUrl = `https://osu.ppy.sh/images/flags/${user.country_code}.png`;
    const playPpText = projection.playPps.map((pp) => `**${formatPp(pp)}pp**`).join(", ");

    if (doesNotAffectTotal) {
        return [
            {
                type: EmbedType.Rich,
                author: {
                    name: `${user.username}: ${formatPp(currentTotalPp)}pp (${formatRank(currentRank)}${formatCountryRank(user.country_code, countryRank)})`,
                    icon_url: flagUrl,
                    url: userUrl,
                },
                description: `${playPpText} would not affect **${user.username}**'s total pp or rank.`,
                thumbnail: { url: user.avatar_url },
            },
        ] satisfies Array<Embed.Structure>;
    }

    return [
        {
            type: EmbedType.Rich,
            author: {
                name: `${user.username}: ${formatPp(currentTotalPp)}pp (${formatRank(currentRank)}${formatCountryRank(user.country_code, countryRank)})`,
                icon_url: flagUrl,
                url: userUrl,
            },
            description: `With ${playPpText}, **${user.username}** would reach **${formatPp(projection.projectedTotalPp)}pp** and approximately **${formatRank(projectedRank)}**.`,
            fields: [
                {
                    name: "Projected",
                    value: [
                        `**PP:** \`${formatPp(projection.projectedTotalPp)}pp\` (+\`${formatPp(projection.ppGain)}pp\`)`,
                        `**Rank:** \`${formatRank(projectedRank)}\`${rankGain}`,
                    ].join("\n"),
                    inline: true,
                },
                {
                    name: "Current",
                    value: [`**PP:** \`${formatPp(currentTotalPp)}pp\``, `**Rank:** \`${formatRank(currentRank)}\``].join("\n"),
                    inline: true,
                },
                {
                    name: "Bonus PP",
                    value: `Preserved at \`${formatPp(projection.currentBonusPp)}pp\``,
                    inline: true,
                },
            ],
            footer: { text: "Rank is estimated from osu!daily's PP browser." },
            thumbnail: { url: user.avatar_url },
        },
    ] satisfies Array<Embed.Structure>;
}
