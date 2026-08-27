import { expect, test, describe, mock } from "bun:test";
import { ScoreData, type User } from "../../src/types/database";
import { Mode } from "../../src/types/osu";

function createUser(scoreData: ScoreData | null): User {
    return {
        id: "1",
        banchoId: "1",
        score_embeds: null,
        embed_type: null,
        mode: null,
        score_data: scoreData,
    };
}

function parseMockBigInt(value: string | number | bigint, fieldName = "value"): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && !Number.isSafeInteger(value))
        throw new Error(`${fieldName} must be a safe integer or decimal string`);
    if (typeof value === "string" && !/^-?\d+$/.test(value)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(value);
}

function mapMockFromPrisma(value: unknown): unknown {
    if (typeof value !== "object" || value === null) return value;
    const mapped = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(mapped)) if (typeof mapped[key] === "bigint") mapped[key] = mapped[key].toString();
    if (typeof mapped.prefixes === "string") {
        const prefixes = JSON.parse(mapped.prefixes);
        if (!Array.isArray(prefixes) || !prefixes.every((prefix) => typeof prefix === "string"))
            throw new Error("guild prefixes must be a JSON array of strings");
        mapped.prefixes = prefixes;
    }
    return mapped;
}

mock.module("@utils/database", () => ({
    getEntry: mock(() => Promise.resolve(null)),
    insertData: mock(() => Promise.resolve()),
    bulkInsertData: mock(() => Promise.resolve()),
    removeEntry: mock(() => Promise.resolve(true)),
    getRowCount: mock(() => Promise.resolve(0)),
    getRowSum: mock(() => Promise.resolve(0)),
    parseBigIntValue: parseMockBigInt,
    mapToPrismaValue: (key: string, value: unknown) =>
        ["joined_at", "user_id", "map_id", "score"].includes(key) ? parseMockBigInt(value as string | number | bigint, key) : value,
    mapFromPrismaValue: mapMockFromPrisma,
    incrementCommandCount: mock(() => Promise.resolve()),
}));

describe("formatter", () => {
    describe("getFormattedProfile", () => {
        const mockUser: any = {
            avatar_url: "https://a.ppy.sh/12345",
            country_code: "US",
            default_group: "default",
            id: 12345,
            is_active: true,
            is_bot: false,
            is_deleted: false,
            is_online: true,
            is_supporter: true,
            last_visit: "2023-01-01T00:00:00Z",
            pm_friends_only: false,
            profile_colour: null,
            username: "peppy",
            cover_url: "https://assets.ppy.sh/users/12345/cover.jpg",
            discord: "peppy#1234",
            has_supported: true,
            interests: "Programming",
            join_date: "2007-08-28T00:00:00Z",
            kudosu: { available: 100, total: 200 },
            location: "Japan",
            max_blocks: 50,
            max_friends: 500,
            occupation: "Developer",
            playmode: "osu",
            playstyle: ["mouse", "keyboard"],
            post_count: 500,
            profile_order: ["me", "recent_activity"],
            title: "Creator",
            title_url: null,
            twitter: "ppy",
            website: "https://ppy.sh",
            country: { code: "US", name: "United States" },
            cover: { custom_url: "https://custom.url", url: "https://cover.url", id: "123" },
            statistics: {
                level: { current: 100, progress: 50 },
                global_rank: 1,
                pp: 20000,
                ranked_score: 10000000000,
                hit_accuracy: 99.99,
                play_count: 50000,
                play_time: 3600000, // 1000 hours
                total_score: 20000000000,
                total_hits: 10000000,
                maximum_combo: 10000,
                replays_watched_by_others: 50000,
                is_ranked: true,
                grade_counts: { ss: 100, ssh: 50, s: 500, sh: 250, a: 1000 },
                country_rank: 1,
            },
            rank_highest: { rank: 1, updated_at: "2020-01-01T00:00:00Z" },
            follower_count: 100000,
            mapping_follower_count: 10000,
            pending_beatmapset_count: 5,
            previous_usernames: ["peppy2"],
            support_level: 3,
            loved_beatmapset_count: 2,
            ranked_beatmapset_count: 50,
            scores_best_count: 100,
            scores_first_count: 5,
            scores_pinned_count: 2,
            scores_recent_count: 10,
            session_verified: true,
            guest_beatmapset_count: 0,
            nominated_beatmapset_count: 0,
            graveyard_beatmapset_count: 0,
            unranked_beatmapset_count: 0,
        };

        test("formats profile data correctly", async () => {
            const { getFormattedProfile } = await import("../../src/utils/formatter");
            const result = getFormattedProfile(mockUser, Mode.OSU);

            expect(result.username).toBe("peppy");
            expect(result.userCover).toBe("https://cover.url");
            expect(result.avatarUrl).toBe("https://a.ppy.sh/12345");
            expect(result.userUrl).toBe("https://osu.ppy.sh/users/12345/osu");
            expect(result.flagUrl).toBe("https://osu.ppy.sh/images/flags/US.png");
            expect(result.globalRank).toBe("1");
            expect(result.countryRank).toBe("1");
            expect(result.pp).toBe("20,000");
            expect(result.accuracy).toBe("99.99");
            expect(result.level).toBe("100.50");
            expect(result.playCount).toBe("50,000");
            expect(result.playHours).toBe("1000");
            expect(result.followers).toBe("100,000");
            expect(result.maxCombo).toBe("10,000");
            expect(result.rankedScore).toBe("10,000,000,000");
            expect(result.totalScore).toBe("20,000,000,000");
            expect(result.objectsHit).toBe("10,000,000");
            expect(result.occupation).toBe("Developer");
            expect(result.interest).toBe("Programming");
            expect(result.location).toBe("Japan");
            expect(result.rankSs).toBe("100");
            expect(result.rankSsh).toBe("50");
            expect(result.rankS).toBe("500");
            expect(result.rankSh).toBe("250");
            expect(result.rankA).toBe("1,000");
        });
    });

    describe("getFormattedScore", () => {
        // Mock a basic .osu file content for the beatmap to avoid fetching
        const mockMapData = `osu file format v14
[General]
AudioFilename: audio.mp3
Mode: 0
[Metadata]
Title:Test Title
Artist:Test Artist
Creator:Test Creator
Version:Test Version
[Difficulty]
HPDrainRate:5
CircleSize:5
OverallDifficulty:5
ApproachRate:5
SliderMultiplier:1.4
SliderTickRate:1
[HitObjects]
256,192,1000,1,0,0:0:0:0:
256,192,2000,1,0,0:0:0:0:
256,192,3000,1,0,0:0:0:0:
`;

        const mockManiaMapData = `osu file format v14
[General]
AudioFilename: audio.mp3
Mode: 3
[Metadata]
Title:Mania Title
Artist:Mania Artist
Creator:Mania Creator
Version:4K
[Difficulty]
HPDrainRate:5
CircleSize:4
OverallDifficulty:5
ApproachRate:5
SliderMultiplier:1.4
SliderTickRate:1
[HitObjects]
64,192,1000,1,0,0:0:0:0:
192,192,1500,1,0,0:0:0:0:
320,192,2000,1,0,0:0:0:0:
448,192,2500,1,0,0:0:0:0:
`;

        function createAccuracyScore(): any {
            return {
                id: 123456790,
                score: 1000000,
                created_at: "2023-01-01T00:00:00Z",
                statistics: {
                    count_300: 2,
                    count_100: 1,
                    count_50: 0,
                    count_miss: 0,
                },
                max_combo: 3,
                mods: [],
                passed: true,
                rank: "A",
                accuracy: 0.99,
                beatmap: {
                    id: 72727,
                    version: "Test Version",
                    total_length: 120,
                    hit_length: 120,
                    bpm: 120,
                    cs: 5,
                    drain: 5,
                    accuracy: 5,
                    ar: 5,
                },
                beatmapset: {
                    id: 1234,
                    artist: "Test Artist",
                    title: "Test Title",
                    creator: "Test Creator",
                    status: "ranked",
                },
            };
        }

        test("formats score data correctly", async () => {
            // Need to import the module at the top, but we can do it here for the test
            const { getFormattedScore } = await import("../../src/utils/formatter");
            const { Mode } = await import("../../src/types/osu");

            const mockScore: any = {
                id: 123456789,
                score: 1000000,
                created_at: "2023-01-01T00:00:00Z",
                statistics: {
                    count_300: 3,
                    count_100: 0,
                    count_50: 0,
                    count_miss: 0,
                },
                max_combo: 3,
                mods: [],
                passed: true,
                rank: "SS",
                accuracy: 1,
                beatmap: {
                    id: 72727,
                    version: "Test Version",
                    total_length: 120,
                    hit_length: 120,
                    bpm: 120,
                    cs: 5,
                    drain: 5,
                    accuracy: 5,
                    ar: 5,
                },
                beatmapset: {
                    id: 1234,
                    artist: "Test Artist",
                    title: "Test Title",
                    creator: "Test Creator",
                    status: "ranked",
                },
            };

            const result = await getFormattedScore({
                scores: [mockScore],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
            });

            expect(result.score).toBe("1,000,000");
            expect(result.accuracy).toBe("100.00");
            expect(result.songNameFormatted).toBe("Test Artist - Test Title");
            expect(result.songArtist).toBe("Test Artist");
            expect(result.songName).toBe("Test Title");
            expect(result.difficultyName).toBe("Test Version");
            expect(result.mapLink).toBe("https://osu.ppy.sh/b/72727");
            expect(result.coverLink).toBe("https://assets.ppy.sh/beatmaps/1234/covers/cover.jpg");
            expect(result.isFc).toBe(true);
            expect(result.drainLength).toBe("2:00");
        });

        test("prefers the API-provided pp when formatting scores", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [{ ...createAccuracyScore(), pp: 321.45 }],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
            });

            expect(result.pp).toBe(321.45);
            expect(result.ppFormatted).toContain("**321.45**");
        });

        test("shows the API-provided pp when performance calculation is unavailable", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [{ ...createAccuracyScore(), pp: 321.45 }],
                index: 0,
                mode: Mode.OSU,
                mapData: mockManiaMapData,
            });

            expect(result.performance).toBeNull();
            expect(result.pp).toBe(321.45);
            expect(result.ppFormatted).toBe("**321.45pp**");
        });

        test("falls back to calculated pp when the API does not provide one", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [createAccuracyScore()],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
            });

            expect(result.performance).not.toBeNull();
            if (!result.performance) throw new Error("Expected performance calculation");
            expect(result.pp).toBe(result.performance.current.pp);
            expect(result.ppFormatted).toContain(`**${result.performance.current.pp.toFixed(2)}`);
        });

        test("uses stable classic accuracy when stable score data is selected", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [createAccuracyScore()],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
                authorDb: createUser(ScoreData.Stable),
            });

            expect(result.accuracy).toBe("77.78");
        });

        test("uses API accuracy when lazer score data is selected", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [createAccuracyScore()],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
                authorDb: createUser(ScoreData.Lazer),
            });

            expect(result.accuracy).toBe("99.00");
        });

        test("uses API accuracy when score data is unset", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");

            const result = await getFormattedScore({
                scores: [createAccuracyScore()],
                index: 0,
                mode: Mode.OSU,
                mapData: mockMapData,
            });

            expect(result.accuracy).toBe("99.00");
        });

        test("uses the score ruleset for mania score performance", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");
            const { Mode } = await import("../../src/types/osu");

            const mockScore: any = {
                id: 987654321,
                score: 1000000,
                created_at: "2023-01-01T00:00:00Z",
                mode: "mania",
                statistics: {
                    perfect: 4,
                    great: 4,
                    good: 0,
                    ok: 0,
                    meh: 0,
                    miss: 0,
                },
                max_combo: 4,
                mods: [],
                passed: true,
                rank: "SS",
                accuracy: 1,
                beatmap: {
                    id: 112233,
                    version: "4K",
                    total_length: 120,
                    bpm: 120,
                    difficulty_rating: 0.25,
                },
                beatmapset: {
                    id: 4321,
                    artist: "Mania Artist",
                    title: "Mania Title",
                    creator: "Mania Creator",
                    status: "ranked",
                },
            };

            const result = await getFormattedScore({
                scores: [mockScore],
                index: 0,
                mode: Mode.OSU,
                mapData: mockManiaMapData,
            });

            expect(result.performance).not.toBeNull();
            expect(result.rulesetEmote).toBe("<:mania:1075928451602718771>");
            expect(result.ppFormatted).not.toBe("PP unavailable");
            expect(result.hitValues).toBe("4/0/0/0/0");
        });

        test("uses a safe pp fallback when performance cannot be calculated", async () => {
            const { getFormattedScore } = await import("../../src/utils/formatter");
            const { Mode } = await import("../../src/types/osu");

            const mockScore: any = {
                id: 987654322,
                score: 1000000,
                created_at: "2023-01-01T00:00:00Z",
                statistics: {
                    count_300: 4,
                    count_100: 0,
                    count_50: 0,
                    count_miss: 0,
                },
                max_combo: 4,
                mods: [],
                passed: true,
                rank: "SS",
                accuracy: 1,
                beatmap: {
                    id: 112234,
                    version: "4K",
                    total_length: 120,
                    bpm: 120,
                    difficulty_rating: 0.25,
                },
                beatmapset: {
                    id: 4322,
                    artist: "Mania Artist",
                    title: "Mania Title",
                    creator: "Mania Creator",
                    status: "ranked",
                },
            };

            const result = await getFormattedScore({
                scores: [mockScore],
                index: 0,
                mode: Mode.OSU,
                mapData: mockManiaMapData,
            });

            expect(result.performance).toBeNull();
            expect(result.ppFormatted).toBe("PP unavailable");
            expect(result.stars).toBe("0.25★");
            expect(result.comboValues).toBe("**4**/4x");
        });
    });
});
