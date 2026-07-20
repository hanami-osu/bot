import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";
import { accuracyCalculator, formatDuration, gradeCalculator, hitValueCalculator } from "../domain/score-calculations";
import { downloadBeatmap } from "../services/beatmap-service";
import { getPerformanceResults } from "../services/performance-service";
import { getEntry } from "@utils/database";
import { grades, rulesets, SPACE } from "@utils/constants";
import { Tables } from "@type/database";
import { EmbedType } from "lilybird";
import { Mode } from "@type/osu";
import type { SimulateBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";

export async function simulateBuilder({ beatmapId, mods, options }: SimulateBuilderOptions): Promise<Array<Embed.Structure>> {
    const beatmapRequest = await safeParse(v2.beatmaps.details({ type: "difficulty", id: beatmapId }));
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
    const { acc, ar, bpm, clock_rate: clockRate, combo, cs, n100, n300, n50, ngeki, nkatu, nmisses, od } = options;

    const { beatmapset: mapset, mode, version } = map;

    const mapData = (await getEntry(Tables.MAP, beatmapId))?.data ?? (await downloadBeatmap(beatmapId)).contents;

    const performance = await getPerformanceResults({
        beatmapId,
        setId: map.mode_int,
        mapData,
        mapSettings: { ar, cs, od },
        maxCombo: combo,
        hitValues: { count_100: n100, count_300: n300, count_50: n50, count_geki: ngeki, count_katu: nkatu, count_miss: nmisses },
        clockRate: clockRate ?? (bpm && map.bpm ? bpm / map.bpm : undefined),
        accuracy: acc,
        mods: mods ?? 0,
        checksum: map.checksum,
    });

    if (performance === null) {
        return [
            {
                title: "ERROR",
                description: "Oops, sorry about that, it seems there was an error. Maybe try again?\n\nPERFORMANCES IS NULL",
            },
        ];
    }
    const { current, mapValues, difficultyAttrs, perfect, fc } = performance;

    const hitValues = {
        count_300: current.state?.n300,
        count_100: current.state?.n100,
        count_50: current.state?.n50,
        count_miss: current.state?.misses,
        count_geki: current.state?.nGeki,
        count_katu: current.state?.nKatu,
    };
    const grade =
        grades[gradeCalculator(map.mode as Mode, hitValues, mods?.map((m) => (typeof m === "string" ? m : m.acronym)) ?? [""])];

    const hitValuesString = hitValueCalculator(map.mode as Mode, hitValues);

    const comboValue = current.state?.maxCombo;
    const comboValues = `**${comboValue}**/${map.max_combo}x`;
    const comboDifference = (comboValue ?? 0) / map.max_combo;

    const accuracy = accuracyCalculator(map.mode as Mode, hitValues);

    const drainLength = formatDuration(map.total_length / difficultyAttrs.clockRate);

    const objects = map.count_circles + map.count_sliders + map.count_spinners;

    const newBpm = difficultyAttrs.clockRate * mapValues.bpm;
    const statsField = [
        `**Stars:** **\`${current.difficulty.stars.toFixed(2)}\`** **Mods:** \`+${mods ? mods.join("") : "NM"}\` **BPM:** \`${newBpm.toFixed(0)}\``,
        `**Length:** \`${drainLength}\` **Max Combo:** \`${current.difficulty.maxCombo}\` **Objects:** \`${objects.toLocaleString()}\``,
        `**AR:** \`${difficultyAttrs.ar.toFixed(1)}\` **OD:** \`${difficultyAttrs.od.toFixed(1)}\` **CS:** \`${difficultyAttrs.cs.toFixed(1)}\` **HP:** \`${difficultyAttrs.hp.toFixed(1)}\``,
    ];

    const scoreField = [
        `${grade} ${SPACE} **${current.pp.toFixed(2)}**/${perfect.pp.toFixed(2)}pp ${
            (typeof current.effectiveMissCount !== "undefined" && current.effectiveMissCount > 1) || comboDifference < 0.99
                ? `~~[**${fc.pp.toFixed(2)}**]~~`
                : ""
        } ${SPACE} ${accuracy.toFixed(2)}% `,
        `[${comboValues}] ${SPACE} {${hitValuesString}}`,
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
                    value: scoreField.join("\n"),
                    inline: false,
                },
                {
                    name: "Stats",
                    value: statsField.join("\n"),
                    inline: false,
                },
            ],
        },
    ];
}
