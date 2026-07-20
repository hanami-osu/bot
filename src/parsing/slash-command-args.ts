import type { ApplicationCommandData } from "@lilybird/transformers";
import { getBeatmapId, parseBeatmapUrl } from "./beatmap-url";
import { buildMods, normalizeStringOption, parseModsString, parseSlashIntegerOption } from "./command-options";
import type { DifficultyOptions, Mods } from "@type/command-args";

export interface SlashCommandOptions {
    explicitIdentity?: string;
    mentionedDiscordUserId?: string;
    explicitMode?: string;
    beatmapId: string | null;
    flags: Record<string, string | undefined>;
    mods: Mods;
    difficultySettings?: DifficultyOptions;
    titleFilter?: string;
    page?: number;
    index?: number;
    grade?: string;
}

export function parseSlashCommandOptions(data: ApplicationCommandData, getAttributes?: boolean): SlashCommandOptions {
    let difficultySettings: DifficultyOptions | undefined;
    if (getAttributes) {
        const attributes: Array<keyof DifficultyOptions> = [
            "combo",
            "acc",
            "clock_rate",
            "bpm",
            "n300",
            "n100",
            "n50",
            "nmisses",
            "ngeki",
            "nkatu",
            "ar",
            "cs",
            "od",
        ];
        difficultySettings = {};
        for (const attribute of attributes) {
            const value = data.getNumber(attribute);
            if (value !== null && typeof value !== "undefined") difficultySettings[attribute] = value;
        }
    }
    const action =
        data.getString("mods_action") ??
        (data.getBoolean("force_include")
            ? "force_include"
            : data.getBoolean("exclude")
              ? "exclude"
              : data.getBoolean("include")
                ? "include"
                : null);
    const titleFilter = normalizeStringOption(data.getString("filter"));
    return {
        explicitIdentity: normalizeStringOption(data.getString("username")),
        mentionedDiscordUserId: data.getUser("discord") ?? undefined,
        explicitMode: data.getString("mode") ?? undefined,
        beatmapId: getBeatmapId(parseBeatmapUrl(data.getString("map") ?? "")),
        flags: {},
        mods: buildMods(parseModsString(data.getString("mods")), action),
        difficultySettings,
        titleFilter,
        page: parseSlashIntegerOption(data.getInteger("page"), "page"),
        index: parseSlashIntegerOption(data.getInteger("index"), "index"),
        grade: normalizeStringOption(data.getString("grade")),
    };
}
