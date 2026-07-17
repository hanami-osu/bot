import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { downloadBeatmap, getPerformanceResults } from "@utils/osu";
import { getEntry } from "@utils/database";
import { rulesets } from "@utils/constants";
import { Mode } from "@type/osu";
import { Tables } from "@type/database";
import { EmbedType } from "lilybird";
import type { BeatmapBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";

export async function beatmapBuilder({ beatmapId, mods }: BeatmapBuilderOptions): Promise<Array<Embed.Structure>> {
    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: Number(beatmapId) }));
    if (!beatmapRequest.success) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: "It seems like this beatmap couldn't be found :(",
            },
        ];
    }
    const map = beatmapRequest.data;

    const { beatmapset: mapset, mode, version } = map;

    const mapData = (await getEntry(Tables.MAP, beatmapId))?.data ?? (await downloadBeatmap(beatmapId)).contents;

    const performancesAsync = [];
    const accuracyList = [98, 97, 95];
    for (const accuracy of accuracyList) {
        const performance = getPerformanceResults({ beatmapId, setId: map.mode_int, mapData, accuracy, mods: mods ?? 0, checksum: map.checksum });
        performancesAsync.push(performance);
    }
    const performances = await Promise.all(performancesAsync);

    const [a98, a97, a95] = performances;
    if (a98 === null || a97 === null || a95 === null) {
        return [
            {
                title: "ERROR",
                description: "Oops, sorry about that, it seems there was an error. Maybe try again?\n\nPERFORMANCES IS NULL",
            },
        ];
    }

    const drainLengthInSeconds = map.total_length / a98.difficultyAttrs.clockRate;
    const drainMinutes = Math.floor(drainLengthInSeconds / 60);
    const drainSeconds = Math.ceil(drainLengthInSeconds % 60);

    const objects = map.count_circles + map.count_sliders + map.count_spinners;

    const infoField = [
        `**Stars:** **\`${a98.current.difficulty.stars.toFixed(2)}\`** **Mods:** \`+${mods ?? "NM"}\` **BPM:** \`${a98.mapValues.bpm.toFixed(0)}\``,
        `**Length:** \`${drainMinutes}:${drainSeconds < 10 ? `0${drainSeconds}` : drainSeconds}\` **Max Combo:** \`${a98.current.difficulty.maxCombo}\` **Objects:** \`${objects.toLocaleString()}\``,
        `**AR:** \`${a98.mapValues.ar.toFixed(1)}\` **OD:** \`${a98.mapValues.od.toFixed(1)}\` **CS:** \`${a98.mapValues.cs.toFixed(1)}\` **HP:** \`${a98.mapValues.hp.toFixed(1)}\``,
        `\n:heart: **${mapset.favourite_count.toLocaleString()}** :play_pause: **${mapset.play_count.toLocaleString()}**`,
    ];

    const ppField = [
        "```Acc  |  PP",
        `100%   ${a98.perfect.pp.toFixed(2)}`,
        `98%    ${a98.current.pp.toFixed(2)}`,
        `97%    ${a97.current.pp.toFixed(2)}`,
        `95%    ${a95.current.pp.toFixed(2)}\`\`\``,
    ];

    const linksField = [
        `<:chimu:1117792339549761576>[Chimu](https://chimu.moe/d/${map.beatmapset_id})`,
        `<:beatconnect:1075915329512931469>[Beatconnect](https://beatconnect.io/b/${map.beatmapset_id})`,
        `:notes:[Song Preview](https://b.ppy.sh/preview/${map.beatmapset_id}.mp3)`,
        `🖼️[Full Background](https://catboy.best/preview/background/${map.beatmapset_id}/set)`,
    ];

    return [
        {
            title: `${mapset.artist} - ${mapset.title}`,
            url: `https://osu.ppy.sh/b/${beatmapId}`,
            thumbnail: { url: `https://assets.ppy.sh/beatmaps/${mapset.id}/covers/list.jpg` },
            author: {
                name: `${mapset.status.charAt(0).toUpperCase()}${mapset.status.slice(1)} mapset by ${mapset.creator}`,
                icon_url: `https://a.ppy.sh/${mapset.user_id}`,
            },
            fields: [
                {
                    name: `${rulesets[mode as keyof typeof rulesets] ?? rulesets[Mode.OSU]} ${version}`,
                    value: infoField.join("\n"),
                    inline: false,
                },
                { name: "PP", value: ppField.join("\n"), inline: true },
                { name: "Links", value: linksField.join("\n"), inline: true },
            ],
        },
    ];
}
