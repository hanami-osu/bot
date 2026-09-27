import { SPACE } from "@utils/constants";
import { EmbedScoreType, type User } from "@type/database";
import { EmbedType, type Embed } from "lilybird";
import type { Mode, ProfileInfo, ScoresInfo } from "@type/osu";

export interface NoChokeScore {
    play: ScoresInfo;
    currentPp: number;
    fcPp: number;
    playMaxCombo: number;
}

export function noChokeEmbed({
    profile,
    mode,
    currentTotalPp,
    noChokeTotalPp,
    gains,
    authorDb,
}: {
    profile: ProfileInfo;
    mode: Mode;
    currentTotalPp: number;
    noChokeTotalPp: number;
    gains: Array<NoChokeScore>;
    authorDb: User | null;
}): Embed.Structure {
    const formatPp = (pp: number) => pp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fcStats = (play: ScoresInfo, playMaxCombo: number) => {
        const maxCombo = play.performance?.current.difficulty.maxCombo;
        return {
            hitValues: play.fcHitValues || play.hitValues,
            comboValues: typeof maxCombo === "number"
                ? `**${playMaxCombo.toLocaleString()}** → **${maxCombo.toLocaleString()}**/${maxCombo.toLocaleString()}x`
                : play.comboValues,
        };
    };
    const title = `**Total pp:** ${formatPp(currentTotalPp)}pp → **${formatPp(noChokeTotalPp)}pp** (+${formatPp(noChokeTotalPp - currentTotalPp)}pp)`;

    const embedType = authorDb?.embed_type ?? EmbedScoreType.Hanami;

    if (embedType === EmbedScoreType.Bathbot) {
        let description = "";
        if (gains.length > 0) {
            for (const { play, currentPp, fcPp, playMaxCombo } of gains) {
                const gain = fcPp - currentPp;
                const { hitValues, comboValues } = fcStats(play, playMaxCombo);
                const line1 = `**#${play.position} [${play.songName} [${play.difficultyName}]](${play.mapLink}) +${play.mods.join("")}** [${play.stars}]\n`;
                const line2 = `${play.grade} ${formatPp(currentPp)}pp → **${formatPp(fcPp)}pp** (+${formatPp(gain)}pp) • ${play.accuracy}% • ${play.score}\n`;
                const line3 = `[ ${comboValues} ] • {${play.hitValues} → **${hitValues}**} • ${play.playSubmitted}`;

                description += `${line1 + line2 + line3}\n`;
            }
        } else {
            description += "No top plays would gain pp from a full combo.";
        }

        return {
            type: EmbedType.Rich,
            title,
            author: {
                name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
                url: profile.userUrl,
                icon_url: profile.flagUrl,
            },
            thumbnail: { url: profile.avatarUrl },
            description,
            footer: { text: `Mode: ${mode}` },
        };
    }

    if (embedType === EmbedScoreType.Owo) {
        let description = "";
        if (gains.length > 0) {
            for (const { play, currentPp, fcPp, playMaxCombo } of gains) {
                const gain = fcPp - currentPp;
                const { hitValues, comboValues } = fcStats(play, playMaxCombo);
                const line1 = `**${play.position}) [${play.songName} [${play.difficultyName}]](${play.mapLink}) +${play.mods.join("")}** [${play.stars}]\n`;
                const line2 = `**▸ ${play.grade} ▸ ${formatPp(currentPp)}pp → ${formatPp(fcPp)}pp (+${formatPp(gain)}pp)** ▸ ${play.accuracy}%\n`;
                const line3 = `▸ ${play.score} x${comboValues} ▸ [${play.hitValues} → **${hitValues}**]\n`;
                const line4 = `▸ Score set ${play.playSubmitted}`;

                description += `${line1 + line2 + line3 + line4}\n`;
            }
        } else {
            description += "No top plays would gain pp from a full combo.";
        }

        return {
            type: EmbedType.Rich,
            title,
            author: {
                name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
                url: profile.userUrl,
                icon_url: profile.flagUrl,
            },
            thumbnail: { url: profile.avatarUrl },
            description,
            footer: { text: "On osu! Bancho" },
        };
    }

    let description = "";
    if (gains.length > 0) {
        for (const { play, currentPp, fcPp, playMaxCombo } of gains) {
            const gain = fcPp - currentPp;
            const { hitValues, comboValues } = fcStats(play, playMaxCombo);
            const line1 = `**#${play.position} [${play.songName} [${play.difficultyName}]](${play.mapLink}) +${play.mods.join("")} ${play.stars}**\n`;
            const line2 = `${play.grade} ${formatPp(currentPp)}pp → **${formatPp(fcPp)}pp** (+${formatPp(gain)}pp) ${SPACE} ${play.score} ${SPACE} **${play.accuracy}%**\n`;
            const line3 = `${play.hitValues} → **${hitValues}** ${SPACE} ${comboValues} ${SPACE} ${play.playSubmitted}`;

            description += `${line1 + line2 + line3}\n`;
        }
    } else {
        description += "No top plays would gain pp from a full combo.";
    }

    return {
        type: EmbedType.Rich,
        title,
        author: {
            name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
            url: profile.userUrl,
            icon_url: profile.flagUrl,
        },
        thumbnail: { url: profile.avatarUrl },
        description,
    };
}
