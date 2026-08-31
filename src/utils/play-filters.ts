import type { ModStructure } from "@type/builders";
import type { UserBestScore, UserBestScoreV2, UserScore, UserScoreV2 } from "@type/osu";

export type FilterablePlay = UserBestScore | UserScore | UserBestScoreV2 | UserScoreV2;

interface PlayFilterOptions {
    mods?: ModStructure;
    titleFilter?: string | null;
}

function playMatchesMods(play: FilterablePlay, mods: ModStructure): boolean {
    const { exclude, forceInclude, include, name } = mods;
    const modName = typeof name === "string" ? name : name?.acronym;
    if (!modName) return true;

    const playMods = play.mods.map(mod => (typeof mod === "string" ? mod : mod.acronym).toUpperCase());
    const requestedMods = modName.toUpperCase().match(/.{1,2}/g) ?? [];

    if (exclude) return !requestedMods.every(requestedMod => playMods.includes(requestedMod));
    if (forceInclude)
        return playMods.length === requestedMods.length && requestedMods.every(requestedMod => playMods.includes(requestedMod));
    if (include) return requestedMods.every(requestedMod => playMods.includes(requestedMod));

    return true;
}

function playMatchesTitle(play: FilterablePlay, titleFilter: string): boolean {
    const normalizedFilter = titleFilter.trim().toLocaleLowerCase();
    if (!normalizedFilter) return true;

    const titles = [play.beatmapset.title, play.beatmapset.title_unicode].filter(
        (title): title is string => typeof title === "string",
    );
    return titles.some(title => title.toLocaleLowerCase().includes(normalizedFilter));
}

export function filterPlays(plays: Array<FilterablePlay>, { mods, titleFilter }: PlayFilterOptions): Array<FilterablePlay> {
    if (!mods?.name && !titleFilter) return plays;

    return plays.filter(
        play => (!mods?.name || playMatchesMods(play, mods)) && (!titleFilter || playMatchesTitle(play, titleFilter)),
    );
}
