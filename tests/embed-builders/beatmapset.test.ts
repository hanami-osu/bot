import { describe, expect, test } from "bun:test";
import { ComponentType } from "lilybird";
import { beatmapsetBuilder } from "../../src/embed-builders/beatmapset";
import { EmbedBuilderType, type BeatmapsetBuilderOptions } from "@type/builders";

function makeDifficulty(id: number, version = `Difficulty ${id}`) {
    return {
        id,
        mode: "osu",
        version,
        difficulty_rating: 4.25,
        total_length: 125,
        bpm: 180,
        accuracy: 8.5,
        ar: 9.5,
        cs: 4,
        drain: 6.5,
        count_circles: 100,
        count_sliders: 200,
        count_spinners: 3,
        max_combo: 900,
    };
}

function makeOptions(
    beatmaps = [makeDifficulty(1001), makeDifficulty(1002), makeDifficulty(1003), makeDifficulty(1004), makeDifficulty(1005)],
    page = 0,
    selectedBeatmapId?: number,
): BeatmapsetBuilderOptions {
    return {
        type: EmbedBuilderType.MAPSET,
        initiatorId: "user-1",
        mods: null,
        page,
        selectedBeatmapId,
        beatmapset: {
            id: 123456,
            artist: "Artist",
            title: "Song",
            creator: "Mapper",
            status: "ranked",
            user_id: 42,
            covers: { list: "https://example.test/cover.jpg" },
            favourite_count: 12,
            play_count: 345,
            beatmaps,
        },
    } as BeatmapsetBuilderOptions;
}

describe("beatmapset embed builder", () => {
    test("renders rich NM difficulty fields and a dropdown for a small set", () => {
        const result = beatmapsetBuilder(makeOptions());
        const embed = result.embeds[0];
        const difficultyRow = result.components[0] as any;

        expect(embed).toMatchObject({
            title: "Artist - Song",
            url: "https://osu.ppy.sh/beatmapsets/123456",
            thumbnail: { url: "https://assets.ppy.sh/beatmaps/123456/covers/list.jpg" },
            author: { name: "Ranked beatmapset by Mapper" },
        });
        expect(embed?.description).toContain(":heart: **12**");
        expect(embed?.description).toContain(":play_pause: **345**");
        expect(embed?.description).toContain("[Chimu]");
        expect(embed?.description).toContain("[Beatconnect]");
        expect(embed?.description).toContain("[Song Preview]");
        expect(embed?.fields).toHaveLength(5);
        expect(embed?.fields?.[0]).toMatchObject({
            name: "<:osu:1075928459014066286> Difficulty 1001",
        });
        expect(embed?.fields?.[0]?.value).toContain("**Stars:** `4.25`");
        expect(embed?.fields?.[0]?.value).toContain("**Max Combo:** `900x`");
        expect(embed?.fields?.[0]?.value).not.toContain("**Length:**");
        expect(embed?.fields?.[0]?.value).not.toContain("**BPM:**");
        expect(embed?.fields?.[0]?.value).toContain("**AR:** `9.5`");
        expect(embed?.fields?.[0]?.value).toContain("**OD:** `8.5`");
        expect(embed?.fields?.[0]?.value).toContain("**CS:** `4.0`");
        expect(embed?.fields?.[0]?.value).toContain("**HP:** `6.5`");
        expect(embed?.fields?.[0]?.value).toContain("**Objects:** `303`");
        expect(difficultyRow.type).toBe(ComponentType.ActionRow);
        expect(difficultyRow.components[0]).toMatchObject({
            type: ComponentType.StringSelect,
            custom_id: "beatmapset-difficulty",
            placeholder: "Select a difficulty",
            min_values: 1,
            max_values: 1,
        });
        expect(difficultyRow.components[0].options).toHaveLength(5);
        expect(difficultyRow.components[0].options[0]).toMatchObject({
            label: "Difficulty 1001",
            value: "1001",
            description: "osu · 4.25★ · 2:05 · 180 BPM",
            emoji: { name: "osu", id: "1075928459014066286" },
        });
        expect(result.components).toHaveLength(1);
    });

    test("shows later difficulties through page pagination", () => {
        const result = beatmapsetBuilder(makeOptions(Array.from({ length: 31 }, (_, index) => makeDifficulty(2000 + index)), 2));
        const embed = result.embeds[0];

        expect(embed?.fields?.[0]?.name).toContain("Difficulty 2010");
        expect(embed?.fields?.[0]?.name).not.toContain("Difficulty 2000");
        expect(embed?.fields).toHaveLength(5);
        expect((result.components[1] as any).components[0].options).toHaveLength(5);
        expect((result.components[1] as any).components[0].options[0].value).toBe("2010");
        expect(result.components).toHaveLength(2);
        expect((result.components[0] as any).components[2].label).toBe("3 / 7");
    });

    test("includes every difficulty in a small set and marks the selected one", () => {
        const result = beatmapsetBuilder(makeOptions(Array.from({ length: 25 }, (_, index) => makeDifficulty(4000 + index)), 0, 4012));
        const select = (result.components[1] as any).components[0];

        expect(select.options).toHaveLength(25);
        expect(select.options[12].default).toBe(true);
        expect(select.options.filter((option: any) => option.default)).toHaveLength(1);
        expect(result.components).toHaveLength(2);
    });

    test("renders a clear empty state without controls for an empty set", () => {
        const result = beatmapsetBuilder(makeOptions([], 0));

        expect(result.embeds[0]?.description).toContain("No difficulties found in this beatmapset.");
        expect(result.components).toEqual([]);
    });

    test("keeps Discord metadata and control lengths within limits", () => {
        const options = makeOptions([makeDifficulty(3001, "x".repeat(5000))]);
        options.beatmapset.artist = "a".repeat(500);
        options.beatmapset.title = "t".repeat(500);
        options.beatmapset.creator = "m".repeat(500);

        const result = beatmapsetBuilder(options);
        const embed = result.embeds[0];
        const select = (result.components[0] as any).components[0];

        expect(embed?.title?.length).toBeLessThanOrEqual(256);
        expect(embed?.author?.name?.length).toBeLessThanOrEqual(256);
        expect(embed?.description?.length).toBeLessThanOrEqual(4096);
        expect(select.options[0].label.length).toBeLessThanOrEqual(100);
        expect(select.options[0].description.length).toBeLessThanOrEqual(100);
        expect(select.options[0].value.length).toBeLessThanOrEqual(100);
        expect(embed?.fields?.every(field => (field.name?.length ?? 0) <= 256)).toBe(true);
        expect(embed?.fields?.every(field => (field.value?.length ?? 0) <= 1024)).toBe(true);
    });
});
