import { getFormattedScore } from "@utils/formatter";
import { SPACE } from "@utils/constants";
import { getEntry } from "@utils/database";
import { downloadBeatmap } from "@utils/osu";
import { Tables } from "@type/database";
import { EmbedType } from "lilybird";
import type { LeaderboardBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";
import type { Beatmap, LeaderboardScore, Mode, ScoresInfo } from "@type/osu";

export async function leaderboardBuilder({ scores, beatmap, page = 0 }: LeaderboardBuilderOptions): Promise<Array<Embed.Structure>> {
    if (scores.length === 0) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: "No scores yet. Maybe you should try setting some? :)",
            },
        ] satisfies Array<Embed.Structure>;
    }

    return getPlays(scores, beatmap, page);
}

async function getPlays(plays: Array<LeaderboardScore>, beatmap: Beatmap, page: number): Promise<Array<Embed.Structure>> {
    const beatmapId = beatmap.id;
    const mode = beatmap.mode as Mode;
    const mapData = (await getEntry(Tables.MAP, beatmapId))?.data ?? (await downloadBeatmap(beatmapId)).contents;

    const pageStart = page * 5;
    const pageEnd = pageStart + 5;

    const playsTemp: Array<Promise<ScoresInfo>> = [];
    for (let i = pageStart; pageEnd > i && i < plays.length; i++) playsTemp.push(getFormattedScore({ scores: plays, index: i, mode, beatmap, mapData }));

    let description = "";
    const playResults = await Promise.all(playsTemp);

    for (const playResult of playResults) {
        const line1 = `**#${playResult.position}** ${playResult.grade} ${SPACE} **[${playResult.user}](https://osu.ppy.sh/u/${playResult.userId}) ${SPACE} [${
            playResult.stars
        }]** ${SPACE} +${playResult.mods.join("")}\n`;
        const line2 = `${playResult.ppFormatted} ${SPACE} **${playResult.accuracy}% ${SPACE} ${playResult.score}**\n`;
        const line3 = `{${playResult.hitValues}} ${SPACE} [${playResult.comboValues}] ${SPACE} ${playResult.playSubmitted}`;

        description += `${line1 + line2 + line3}\n`;
    }

    const { beatmapset } = beatmap;
    const embed: Embed.Structure = {
        type: EmbedType.Rich,
        title: `${beatmapset.artist} - ${beatmapset.title} [${beatmap.version}]`,
        url: `https://osu.ppy.sh/b/${beatmap.id}`,
        thumbnail: { url: `https://assets.ppy.sh/beatmaps/${beatmapset.id}/covers/list.jpg` },
        description,
        footer: {
            text: `${beatmap.status.charAt(0).toUpperCase()}${beatmap.status.slice(1)} beatmapset by ${beatmap.beatmapset.creator} ${SPACE} - ${SPACE} Page ${page + 1} of ${Math.ceil(plays.length / 5)}`,
        },
    };

    return [embed] satisfies Array<Embed.Structure>;
}
