import { EmbedScoreType, ScoreData, ScoreEmbed, type User } from "@type/database";
import type { Embed } from "lilybird";
import { EMBED_COLORS } from "./common";

export interface ConfigChange {
    type: string;
    data: string;
}

const configDefaults: Record<string, string> = {
    score_embeds: "Maximized",
    mode: "osu",
    embed_type: "Hanami",
    score_data: "Stable",
};

const configLabels: Record<string, string> = {
    score_embeds: "Score layout",
    mode: "Game mode",
    embed_type: "Embed style",
    score_data: "Score data",
};

export function configUpdatedEmbed(username: string, changes: Array<ConfigChange>): Embed.Structure {
    const changesText = changes.map(change => `**${getConfigLabel(change.type)}:** \`${change.data}\``).join("\n");

    return {
        title: `Updated settings for ${username}`,
        description: `Updated settings:\n${changesText}`,
        color: EMBED_COLORS.success,
    };
}

export function configListEmbed(username: string, user: User): Embed.Structure {
    const embed: Embed.Structure = { fields: [], title: `Config settings of ${username}`, color: EMBED_COLORS.brand };

    for (const [key, v] of Object.entries(user)) {
        const value = v as string | number | null;
        if (key === "id" || key === "banchoId") continue;

        if (value !== null) {
            embed.fields?.push({ name: getConfigLabel(key), value: getConfigDisplayValue(key, value) });
        } else {
            embed.fields?.push({ name: getConfigLabel(key), value: configDefaults[key] ?? "Unknown" });
        }
    }

    return embed;
}

function getConfigLabel(key: string): string {
    return configLabels[key] ?? key;
}

function getConfigDisplayValue(key: string, value: string | number): string {
    if (key === "score_embeds" && typeof value === "number") {
        return ScoreEmbed[value] ?? configDefaults.score_embeds;
    }

    if (key === "score_data" && typeof value === "number") {
        return ScoreData[value] ?? configDefaults.score_data;
    }

    if (key === "embed_type" && typeof value === "string") {
        return Object.values(EmbedScoreType).includes(value as EmbedScoreType) ? value : configDefaults.embed_type;
    }

    if (key === "mode" && typeof value === "string") {
        return value || configDefaults.mode;
    }

    return value.toString();
}
