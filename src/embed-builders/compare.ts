import { getFormattedProfile, getFormattedScore } from "@utils/formatter";
import { SPACE } from "@utils/constants";
import { getEntry } from "@utils/database";
import { downloadBeatmap, saveScoreDatas } from "@utils/osu";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { Tables } from "@type/database";
import { EmbedType } from "lilybird";
import type { CompareBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";
import type { Beatmap, Mode, ProfileInfo, Score, ScoreV2 } from "@type/osu";

export async function compareBuilder({
    beatmap,
    plays,
    user,
    mode,
    authorDb,
    mods,
    page = 0,
}: CompareBuilderOptions): Promise<Array<Embed.Structure>> {
    saveScoreDatas(plays, mode, beatmap);

    const profile = getFormattedProfile(user, mode);

    if (mods?.name) {
        const { exclude, forceInclude, include, name } = mods;
        const filteredPlays = [];
        for (const play of plays) {
            const modsStr = play.mods.map((mod) => (typeof mod === "string" ? mod : mod.acronym)).join("");
            const modName = typeof name === "string" ? name : name?.acronym;

            if (modName) {
                if (exclude && !modsStr.includes(modName.toUpperCase())) filteredPlays.push(play);
                else if (forceInclude && modsStr === modName.toUpperCase()) filteredPlays.push(play);
                else if (include && modsStr.includes(modName.toUpperCase())) filteredPlays.push(play);
            } else if (!exclude && !forceInclude && !include) filteredPlays.push(play);
        }
        plays = filteredPlays;
    }

    if (plays.length === 0) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: `It seems like \`${profile.username}\` doesn't have any scores on this beatmap with these! :(`,
            },
        ] satisfies Array<Embed.Structure>;
    }

    return getMultiplePlays({ plays, profile, beatmap, mode, authorDb, page });
}

async function getMultiplePlays({
    plays,
    profile,
    beatmap,
    mode,
    authorDb,
    page,
}: {
    plays: Array<Score | ScoreV2>;
    profile: ProfileInfo;
    beatmap: Beatmap;
    mode: Mode;
    authorDb: CompareBuilderOptions["authorDb"];
    page: number;
}): Promise<Array<Embed.Structure>> {
    const beatmapId = beatmap.id;
    const mapData = (await getEntry(Tables.MAP, beatmapId))?.data ?? (await downloadBeatmap(beatmapId)).contents;

    const pageStart = page * ITEMS_PER_PAGE;
    const pageEnd = pageStart + ITEMS_PER_PAGE;
    const formattedPlays = await Promise.all(
        plays.map((_play, index) => getFormattedScore({ scores: plays, index, mode, beatmap, mapData, authorDb })),
    );
    const playResults = formattedPlays
        .map((play, index) => ({ play, index }))
        .sort((a, b) => b.play.pp - a.play.pp || a.index - b.index)
        .slice(pageStart, pageEnd)
        .map(({ play }) => play);

    const { beatmapset } = beatmap;

    let description = "";

    for (const playResult of playResults) {
        const line1 = `${playResult.grade} **[${playResult.stars}]** ${SPACE}  ${playResult.ppFormatted} ${SPACE} **${playResult.accuracy}% ${SPACE} +${playResult.mods.join("")}**\n`;
        const line2 = `${playResult.score} ${SPACE} {${playResult.hitValues}} ${SPACE} [${playResult.comboValues}] ${SPACE} ${playResult.playSubmitted}`;
        description += `${line1 + line2}\n`;
    }

    const embed: Embed.Structure = {
        type: EmbedType.Rich,
        author: {
            name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
            url: profile.userUrl,
            icon_url: profile.flagUrl,
        },
        title: `${beatmapset.artist} - ${beatmapset.title} [${beatmap.version}]`,
        url: `https://osu.ppy.sh/b/${beatmap.id}`,
        thumbnail: { url: `https://assets.ppy.sh/beatmaps/${beatmapset.id}/covers/list.jpg` },
        description,
        footer: {
            text: `${beatmap.status.charAt(0).toUpperCase()}${beatmap.status.slice(1)} beatmapset by ${beatmap.beatmapset.creator} ${SPACE} - ${SPACE} Page ${page + 1} of ${Math.ceil(plays.length / ITEMS_PER_PAGE)}`,
        },
    };

    return [embed] satisfies Array<Embed.Structure>;
}
