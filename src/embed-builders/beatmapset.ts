import { ComponentType, EmbedType } from "lilybird";
import type { Embed, Message } from "lilybird";
import type { BeatmapsetBuilderOptions } from "@type/builders";
import { rulesets } from "@utils/constants";
import { formatDuration } from "@utils/osu";
import { createPaginationActionRow, ITEMS_PER_PAGE } from "@utils/pagination";

function truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function getRulesetEmoji(mode: string) {
    const rulesetEmoji = rulesets[mode as keyof typeof rulesets];
    const match = rulesetEmoji && /^<:(\w+):(\d+)>$/.exec(rulesetEmoji);
    return match ? { name: match[1], id: match[2] } : undefined;
}

function formatDifficultySummary(
    difficulty: BeatmapsetBuilderOptions["beatmapset"]["beatmaps"][number],
): string {
    return `${difficulty.mode} · ${difficulty.difficulty_rating.toFixed(2)}★ · ${formatDuration(difficulty.total_length)} · ${difficulty.bpm.toFixed(0)} BPM`;
}

function formatDifficultyField(
    difficulty: BeatmapsetBuilderOptions["beatmapset"]["beatmaps"][number],
): Embed.FieldStructure {
    const details = [
        `**Stars:** \`${difficulty.difficulty_rating.toFixed(2)}\` **Max Combo:** \`${difficulty.max_combo}x\``,
        `**AR:** \`${difficulty.ar.toFixed(1)}\` **OD:** \`${difficulty.accuracy.toFixed(1)}\` **CS:** \`${difficulty.cs.toFixed(1)}\` **HP:** \`${difficulty.drain.toFixed(1)}\``,
        `**Objects:** \`${(difficulty.count_circles + difficulty.count_sliders + difficulty.count_spinners).toLocaleString()}\``,
    ];
    const emoji = getRulesetEmoji(difficulty.mode);
    const version = truncate(difficulty.version, 100);

    return {
        name: `${emoji ? `<:${emoji.name}:${emoji.id}> ` : ""}${version}`,
        value: truncate(details.join("\n"), 1024),
        inline: false,
    };
}

function createDifficultySelector(
    difficulties: BeatmapsetBuilderOptions["beatmapset"]["beatmaps"],
    selectedBeatmapId: number | undefined,
): Message.Component.ActionRowStructure {
    return {
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.StringSelect,
                custom_id: "beatmapset-difficulty",
                placeholder: "Select a difficulty",
                min_values: 1,
                max_values: 1,
                options: difficulties.map(difficulty => ({
                    label: truncate(difficulty.version, 100),
                    value: String(difficulty.id),
                    description: truncate(formatDifficultySummary(difficulty), 100),
                    default: difficulty.id === selectedBeatmapId,
                    emoji: getRulesetEmoji(difficulty.mode),
                })),
            },
        ],
    };
}

export function beatmapsetBuilder(options: BeatmapsetBuilderOptions): {
    embeds: Array<Embed.Structure>;
    components: Array<Message.Component.Structure>;
} {
    const { beatmapset, page } = options;
    const pageStart = Math.max(0, page) * ITEMS_PER_PAGE;
    const pageDifficulties = beatmapset.beatmaps.slice(pageStart, pageStart + ITEMS_PER_PAGE);
    const selectDifficulties = beatmapset.beatmaps.length <= 25 ? beatmapset.beatmaps : pageDifficulties;
    const status = `${beatmapset.status.charAt(0).toUpperCase()}${beatmapset.status.slice(1)}`;
    const links = [
        `<:chimu:1117792339549761576>[Chimu](https://chimu.moe/d/${beatmapset.id})`,
        `<:beatconnect:1075915329512931469>[Beatconnect](https://beatconnect.io/b/${beatmapset.id})`,
        `:notes:[Song Preview](https://b.ppy.sh/preview/${beatmapset.id}.mp3)`,
    ];

    const components: Array<Message.Component.Structure> = [];
    if (pageDifficulties.length > 0) {
        if (beatmapset.beatmaps.length > ITEMS_PER_PAGE) components.push(...createPaginationActionRow(options));
        components.push(createDifficultySelector(selectDifficulties, options.selectedBeatmapId));
    }

    return {
        embeds: [
            {
                type: EmbedType.Rich,
                title: truncate(`${beatmapset.artist} - ${beatmapset.title}`, 256),
                url: `https://osu.ppy.sh/beatmapsets/${beatmapset.id}`,
                thumbnail: { url: `https://assets.ppy.sh/beatmaps/${beatmapset.id}/covers/list.jpg` },
                author: {
                    name: truncate(`${status} beatmapset by ${beatmapset.creator}`, 256),
                    icon_url: `https://a.ppy.sh/${beatmapset.user_id}`,
                },
                description: [
                    `:heart: **${beatmapset.favourite_count.toLocaleString()}** :play_pause: **${beatmapset.play_count.toLocaleString()}**`,
                    links.join(" · "),
                    pageDifficulties.length === 0 ? "No difficulties found in this beatmapset." : "Base difficulty stats are shown as NM.",
                ].join("\n"),
                fields: pageDifficulties.map(formatDifficultyField),
            },
        ],
        components,
    };
}
