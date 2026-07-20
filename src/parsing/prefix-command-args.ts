import { getBeatmapId, parseBeatmapUrl } from "./beatmap-url";
import { normalizeStringOption, parseModsString, parsePrefixPageFlag } from "./command-options";
import type { Mods } from "@type/command-args";

export interface PrefixCommandOptions {
    explicitIdentity?: string;
    mentionedDiscordUserId?: string;
    beatmapId: string | null;
    flags: Record<string, string | undefined>;
    mods: Mods;
    titleFilter?: string;
    page?: number;
}

export function parsePrefixCommandOptions(args: Array<string>): PrefixCommandOptions {
    const copiedArgs = [...args];
    const firstMap = copiedArgs.map(parseBeatmapUrl).find((parsed) => parsed !== null);
    const beatmapId = getBeatmapId(firstMap ?? null);
    if (firstMap)
        copiedArgs.splice(
            copiedArgs.findIndex((arg) => arg === firstMap.url),
            1,
        );

    const flags: Record<string, string | undefined> = {};
    const identities: Array<string> = [];
    let mods: Mods = { exclude: null, include: null, forceInclude: null, name: null };
    const tokens = copiedArgs.join(" ").match(/(?:[^\s="]+=".*?"|".*?"|\S+)/g) ?? [];
    for (const token of tokens) {
        const flagMatch = /^([^=\s]+)=(.*)$/.exec(token);
        if (flagMatch) {
            flags[flagMatch[1]] = flagMatch[2].replace(/^"(.*)"$/, "$1");
            continue;
        }
        if (token.includes('"')) {
            identities.push(token.replace(/"/g, ""));
            continue;
        }
        const [, modType, mod, force] = /^([+-])([A-Za-z0-9]+)(!)?$/.exec(token) ?? [];
        if (mod) {
            const name = parseModsString(mod);
            const include = typeof force === "undefined";
            mods = {
                name,
                include,
                exclude: modType === "-" && !include,
                forceInclude: modType === "+" && !include,
            };
            continue;
        }
        const [key, value] = token.split("=");
        if (key && !value) identities.push(key);
        else if (key && value) flags[key] = value;
    }
    const explicitIdentity = identities[0];
    const mentionedDiscordUserId = explicitIdentity ? /<@(\d+)>/.exec(explicitIdentity)?.[1] : undefined;
    return {
        explicitIdentity,
        mentionedDiscordUserId,
        beatmapId,
        flags,
        mods,
        titleFilter: normalizeStringOption(flags.filter),
        page: parsePrefixPageFlag(flags),
    };
}
