import { describe, expect, mock, test } from "bun:test";
import { Mode } from "../../src/types/osu";
import { UserType } from "../../src/types/command-args";
import { Tables } from "../../src/types/database";
import type { ApplicationCommandData, GuildInteraction, Message } from "@lilybird/transformers";

const linkedUsers = new Map<string, { id: string; banchoId: string | null }>([["123456789012345678", { id: "123456789012345678", banchoId: "yorunoken" }]]);

function parseMockBigInt(value: string | number | bigint, fieldName = "value"): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error(`${fieldName} must be a safe integer or decimal string`);
    if (typeof value === "string" && !/^-?\d+$/.test(value)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(value);
}

function mapMockFromPrisma(value: unknown): unknown {
    if (typeof value !== "object" || value === null) return value;
    const mapped = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(mapped)) if (typeof mapped[key] === "bigint") mapped[key] = mapped[key].toString();
    if (typeof mapped.prefixes === "string") {
        const prefixes = JSON.parse(mapped.prefixes);
        if (!Array.isArray(prefixes) || !prefixes.every((prefix) => typeof prefix === "string")) throw new Error("guild prefixes must be a JSON array of strings");
        mapped.prefixes = prefixes;
    }
    return mapped;
}

mock.module("@utils/database", () => ({
    getEntry: mock((table: Tables, id: string) => {
        if (table !== Tables.USER) return Promise.resolve(null);
        return Promise.resolve(linkedUsers.get(id) ?? null);
    }),
    insertData: mock(() => Promise.resolve()),
    bulkInsertData: mock(() => Promise.resolve()),
    removeEntry: mock(() => Promise.resolve(true)),
    getRowCount: mock(() => Promise.resolve(0)),
    getRowSum: mock(() => Promise.resolve(0)),
    parseBigIntValue: parseMockBigInt,
    mapToPrismaValue: (key: string, value: unknown) => (["joined_at", "user_id", "map_id", "score"].includes(key) ? parseMockBigInt(value as string | number | bigint, key) : value),
    mapFromPrismaValue: mapMockFromPrisma,
    incrementCommandCount: mock(() => Promise.resolve()),
}));

const { CommandValidationError, getCommandArgs, parseBeatmapUrl, parseOsuArguments } = await import("../../src/utils/args");

describe("args parser", () => {
    describe("parseBeatmapUrl", () => {
        test.each([
            ["https://osu.ppy.sh/b/72727", "72727"],
            ["https://osu.ppy.sh/beatmaps/72727", "72727"],
            ["https://osu.ppy.sh/beatmapsets/123456#osu/72727", "72727"],
        ] as const)("extracts beatmap id from %s", (url, expected) => {
            const parsed = parseBeatmapUrl(url);
            expect(parsed && ("id" in parsed ? parsed.id : parsed.difficultyId)).toBe(expected);
        });

        test.each(["https://example.com/b/72727", "https://osu.ppy.sh/users/72727", "https://osu.ppy.sh/beatmapsets/123456#osu/not-a-number"])("rejects unrelated URL %s", (url) => {
            expect(parseBeatmapUrl(url)).toBeNull();
        });
    });

    describe("parseOsuArguments", () => {
        test("parses explicit user, map, flags, and force-excluded mods", async () => {
            const message = { author: { id: "0000" } } as unknown as Message;
            const result = await parseOsuArguments(message, ["peppy", "https://osu.ppy.sh/b/72727", "p=3", "-HDHR!"], Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("peppy");
            expect(result.user.beatmapId).toBe("72727");
            expect(result.flags.p).toBe("3");
            expect(result.mods.exclude).toBe(true);
            expect(result.mods.name).toBe("HDHR");
        });

        test("parses quoted flag values without treating them as usernames", async () => {
            const message = { author: { id: "0000" } } as unknown as Message;
            const result = await parseOsuArguments(message, ["peppy", 'filter="yami', "no", 'uta"'], Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("peppy");
            expect(result.flags.filter).toBe("yami no uta");
        });

        test("resolves linked Discord mentions through injected database lookup", async () => {
            const message = { author: { id: "0000" } } as unknown as Message;
            const result = await parseOsuArguments(message, ["<@123456789012345678>"], Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("yorunoken");
        });

        test("rejects unknown and contradictory mods", async () => {
            const message = { author: { id: "0000" } } as unknown as Message;
            await expect(parseOsuArguments(message, ["peppy", "+ZZ"], Mode.OSU)).rejects.toBeInstanceOf(CommandValidationError);
            await expect(parseOsuArguments(message, ["peppy", "+DTNC"], Mode.OSU)).rejects.toBeInstanceOf(CommandValidationError);
        });
    });

    describe("getCommandArgs", () => {
        const createMockInteraction = (options: Record<string, string | number | boolean | null>, userId = "0000") => ({
            member: { user: { id: userId } },
            data: {
                options: Object.entries(options).map(([name, value]) => ({ name, value })),
                getString: (name: string) => (typeof options[name] === "string" ? options[name] : null),
                getNumber: (name: string) => (typeof options[name] === "number" ? options[name] : null),
                getUser: (name: string) => (typeof options[name] === "string" && name === "discord" ? options[name] : null),
                getBoolean: (name: string) => (typeof options[name] === "boolean" ? options[name] : null),
            },
        });

        test("parses slash mode, map, mods_action, and difficulty attributes", async () => {
            const interaction = createMockInteraction({
                username: "peppy",
                mode: Mode.TAIKO,
                map: "https://osu.ppy.sh/beatmaps/72727",
                mods: "HDHR",
                mods_action: "force_include",
                bpm: 200,
                cs: 5,
            });

            const result = await getCommandArgs(interaction as unknown as GuildInteraction<ApplicationCommandData>, true);
            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) {
                expect(result.user.banchoId).toBe("peppy");
                expect(result.user.mode).toBe(Mode.TAIKO);
                expect(result.user.beatmapId).toBe("72727");
            }

            expect(result.mods.name).toBe("HDHR");
            expect(result.mods.forceInclude).toBe(true);
            expect(result.difficultySettings?.bpm).toBe(200);
            expect(result.difficultySettings?.cs).toBe(5);
        });
    });
});
