import { describe, expect, test } from "bun:test";
import { filterPlays, type FilterablePlay } from "../../src/utils/play-filters";

function play(id: number, mods: Array<string>): FilterablePlay {
    return { id, mods: mods.map(acronym => ({ acronym })), rank: "A", beatmapset: { title: "Song" } } as unknown as FilterablePlay;
}

const plays = [play(1, []), play(2, ["CL"]), play(3, ["HD", "CL"]), play(4, ["HD", "DT"])];
const ids = (result: Array<FilterablePlay>): Array<number> => result.map(result => (result as unknown as { id: number }).id);

describe("filterPlays mods", () => {
    test("+NM matches no-mod plays, including stable plays that only carry CL", () => {
        expect(ids(filterPlays(plays, { mods: { name: "NM", include: true, exclude: null, forceInclude: null } }))).toEqual([1, 2]);
    });

    test("-NM! matches plays with mods", () => {
        expect(ids(filterPlays(plays, { mods: { name: "NM", include: null, exclude: true, forceInclude: null } }))).toEqual([3, 4]);
    });

    test("+HD! ignores the CL that stable plays carry", () => {
        expect(ids(filterPlays(plays, { mods: { name: "HD", include: null, exclude: null, forceInclude: true } }))).toEqual([3]);
    });

    test("+CL still matches CL when asked for", () => {
        expect(ids(filterPlays(plays, { mods: { name: "CL", include: true, exclude: null, forceInclude: null } }))).toEqual([2, 3]);
    });
});
