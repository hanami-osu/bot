import type { ModStructure } from "@type/builders";
import type { UserBestScore, UserBestScoreV2, UserScore, UserScoreV2 } from "@type/osu";

export type FilterablePlay = UserBestScore | UserScore | UserBestScoreV2 | UserScoreV2;

interface PlayFilterOptions {
    mods?: ModStructure;
    titleFilter?: string | null;
    grade?: string | null;
}

function playMatchesGrade(play: FilterablePlay, grade: string): boolean {
    const rank = play.rank.toUpperCase();
    const normalizedGrade = grade.toUpperCase();

    if (normalizedGrade === "SS") return ["SS", "SSH", "X", "XH"].includes(rank);
    if (normalizedGrade === "S") return ["S", "SH"].includes(rank);
    return rank === normalizedGrade;
}

function playMatchesMods(play: FilterablePlay, mods: ModStructure): boolean {
    const { exclude, forceInclude, include, name } = mods;
    const modName = typeof name === "string" ? name : name?.acronym;
    if (!modName) return true;

    const normalizedModName = modName.toUpperCase();
    const requestedMods: Array<string> = normalizedModName === "NM" ? [] : normalizedModName.match(/.{1,2}/g) ?? [];
    // Stable scores carry CL in lazer-format responses; only count it when it was asked for.
    const playMods = play.mods
        .map(mod => (typeof mod === "string" ? mod : mod.acronym).toUpperCase())
        .filter(mod => mod !== "CL" || requestedMods.includes("CL"));

    if (requestedMods.length === 0) return exclude ? playMods.length > 0 : playMods.length === 0;

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

export function filterPlays(plays: Array<FilterablePlay>, { mods, titleFilter, grade }: PlayFilterOptions): Array<FilterablePlay> {
    if (!mods?.name && !titleFilter && !grade) return plays;

    return plays.filter(
        play =>
            (!mods?.name || playMatchesMods(play, mods))
            && (!titleFilter || playMatchesTitle(play, titleFilter))
            && (!grade || playMatchesGrade(play, grade)),
    );
}
