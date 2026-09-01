import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../src/utils/command-context";
import { Mode } from "../../src/types/osu";
import { UserType } from "../../src/types/command-args";
import { Tables } from "../../src/types/database";
import type { Client } from "lilybird";
import type { ApplicationCommandData, Interaction, Message } from "@lilybird/transformers";

const linkedUsers = new Map<string, { id: string; banchoId: string | null; mode?: string | null }>([
    ["123456789012345678", { id: "123456789012345678", banchoId: "yorunoken" }],
]);

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
        if (!Array.isArray(prefixes) || !prefixes.every(prefix => typeof prefix === "string"))
            throw new Error("guild prefixes must be a JSON array of strings");
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
    mapToPrismaValue: (key: string, value: unknown) =>
        ["joined_at", "user_id", "map_id", "score"].includes(key) ? parseMockBigInt(value as string | number | bigint, key) : value,
    mapFromPrismaValue: mapMockFromPrisma,
    incrementCommandCount: mock(() => Promise.resolve()),
}));

const { CommandValidationError, parseBeatmapUrl, parseCommandArgs, parsePrefixPageFlag } = await import("../../src/utils/args");

const mockClient = {} as unknown as Client;

beforeEach(() => {
    linkedUsers.clear();
    linkedUsers.set("123456789012345678", { id: "123456789012345678", banchoId: "yorunoken" });
});

function createPrefixContext(args: Array<string>, index?: number, commandName = "top"): CommandContext {
    const message = { author: { id: "0000" } } as unknown as Message;
    return new CommandContext(mockClient, undefined, message, args, "!", commandName, undefined, index);
}

function createMockInteraction(
    options: Record<string, string | number | boolean | null>,
    userId = "0000",
    includeRawOptions = true,
): Interaction<ApplicationCommandData> {
    const data = {
        ...(includeRawOptions ? { options: Object.entries(options).map(([name, value]) => ({ name, value })) } : {}),
        getString: (name: string) => (typeof options[name] === "string" ? options[name] : undefined),
        getNumber: (name: string) => (typeof options[name] === "number" ? options[name] : undefined),
        getInteger: (name: string) => (typeof options[name] === "number" ? options[name] : undefined),
        getUser: (name: string) => (typeof options[name] === "string" && name === "discord" ? options[name] : undefined),
        getBoolean: (name: string) => (typeof options[name] === "boolean" ? options[name] : undefined),
    } as unknown as ApplicationCommandData;

    return {
        member: { user: { id: userId } },
        data,
        inGuild: () => true,
        inDM: () => false,
    } as unknown as Interaction<ApplicationCommandData>;
}

function createInteractionContext(
    options: Record<string, string | number | boolean | null>,
    includeRawOptions = true,
): CommandContext {
    return new CommandContext(mockClient, createMockInteraction(options, "0000", includeRawOptions));
}

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

        test.each([
            "https://example.com/b/72727",
            "https://osu.ppy.sh/users/72727",
            "https://osu.ppy.sh/beatmapsets/123456#osu/not-a-number",
        ])("throws invalid URL error for %s", (url) => {
            expect(() => parseBeatmapUrl(url)).toThrow(
                new CommandValidationError("That doesn't look like a valid osu! beatmap URL."),
            );
        });

        test("throws beatmapset error for set-only URL", () => {
            expect(() => parseBeatmapUrl("https://osu.ppy.sh/beatmapsets/123456")).toThrow(
                new CommandValidationError("Please provide a specific difficulty link instead of a beatmapset link."),
            );
        });
    });

    describe("parseCommandArgs prefix input", () => {
        test("parses explicit user, map, flags, and force-excluded mods", async () => {
            const result = await parseCommandArgs(
                createPrefixContext(["peppy", "https://osu.ppy.sh/b/72727", "p=3", "-HDHR!"]),
                Mode.OSU,
            );

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("peppy");
            expect(result.user.beatmapId).toBe("72727");
            expect(result.flags.p).toBe("3");
            expect(result.page).toBe(2);
            expect(result.mods.exclude).toBe(true);
            expect(result.mods.name).toBe("HDHR");
        });

        test.each([
            ["+HDHR", true, false, false],
            ["+HDHR!", false, false, true],
            ["-HDHR", true, false, false],
            ["-HDHR!", false, true, false],
        ] as const)("parses prefix mod action %s", async (modArg, include, exclude, forceInclude) => {
            const result = await parseCommandArgs(createPrefixContext(["peppy", modArg]), Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("peppy");
            expect(result.mods.include).toBe(include);
            expect(result.mods.exclude).toBe(exclude);
            expect(result.mods.forceInclude).toBe(forceInclude);
            expect(result.mods.name).toBe("HDHR");
        });

        test("parses quoted flag values without treating them as usernames", async () => {
            const result = await parseCommandArgs(createPrefixContext(["peppy", "filter=\"Yami", "no", "Uta\""]), Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("peppy");
            expect(result.flags.filter).toBe("Yami no Uta");
            expect(result.titleFilter).toBe("Yami no Uta");
        });

        test("resolves linked Discord mentions through injected database lookup", async () => {
            const result = await parseCommandArgs(createPrefixContext(["<@123456789012345678>"]), Mode.OSU);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.banchoId).toBe("yorunoken");
        });

        test("rejects unknown and contradictory mods", async () => {
            await expect(parseCommandArgs(createPrefixContext(["peppy", "+ZZ"]), Mode.OSU)).rejects.toBeInstanceOf(
                CommandValidationError,
            );
            await expect(parseCommandArgs(createPrefixContext(["peppy", "+DTNC"]), Mode.OSU)).rejects.toBeInstanceOf(
                CommandValidationError,
            );
        });

        test("uses prefix command suffix indexes as zero-based indexes", async () => {
            const result = await parseCommandArgs(createPrefixContext(["peppy"], 2), Mode.OSU);
            expect(result.index).toBe(2);
        });
    });

    describe("parsePrefixPageFlag", () => {
        test("parses prefix page flags as zero-based pages", () => {
            expect(parsePrefixPageFlag({ p: "3" }, 40)).toBe(2);
            expect(parsePrefixPageFlag({ page: "4" }, 40)).toBe(3);
            expect(parsePrefixPageFlag({})).toBeUndefined();
        });

        test.each([{ p: "" }, { p: "abc" }, { p: "1.5" }, { p: "0" }, { p: "41" }] as Array<Record<string, string>>)(
            "rejects invalid prefix page flag %p",
            (flags) => {
                expect(() => parsePrefixPageFlag(flags, 40)).toThrow(CommandValidationError);
            },
        );
    });

    describe("parseCommandArgs slash input", () => {
        test("parses slash mode, map, mods_action, and difficulty attributes", async () => {
            const ctx = createInteractionContext({
                username: "peppy",
                mode: Mode.TAIKO,
                map: "https://osu.ppy.sh/beatmaps/72727",
                mods: "HDHR",
                mods_action: "force_include",
                bpm: 200,
                cs: 5,
            });

            const result = await parseCommandArgs(ctx, Mode.OSU, true);
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

        test("normalizes slash filter without relying on raw data options", async () => {
            const result = await parseCommandArgs(
                createInteractionContext({ username: "peppy", filter: "sidetracked" }, false),
                Mode.OSU,
            );
            expect(result.titleFilter).toBe("sidetracked");
            expect(result.flags.filter).toBeUndefined();
        });

        test("normalizes slash page and index as zero-based values", async () => {
            const pageResult = await parseCommandArgs(createInteractionContext({ username: "peppy", page: 3 }), Mode.OSU);
            const indexResult = await parseCommandArgs(createInteractionContext({ username: "peppy", index: 3 }), Mode.OSU);

            expect(pageResult.page).toBe(2);
            expect(indexResult.index).toBe(2);
        });

        test("parses slash mods", async () => {
            const result = await parseCommandArgs(
                createInteractionContext({ username: "peppy", mods: "HDHR", mods_action: "exclude" }),
                Mode.OSU,
            );

            expect(result.mods.name).toBe("HDHR");
            expect(result.mods.exclude).toBe(true);
        });

        test("prioritizes explicit slash mode over saved config", async () => {
            linkedUsers.set("0000", { id: "0000", banchoId: "linked", mode: Mode.MANIA });

            const result = await parseCommandArgs(createInteractionContext({ username: "peppy", mode: Mode.TAIKO }));

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.TAIKO);
        });

        test("uses saved mode when slash mode is not explicit", async () => {
            linkedUsers.set("0000", { id: "0000", banchoId: "linked", mode: Mode.MANIA });

            const result = await parseCommandArgs(createInteractionContext({ username: "peppy" }));

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.MANIA);
        });

        test("uses osu mode when slash mode and saved config are unset", async () => {
            linkedUsers.delete("0000");

            const result = await parseCommandArgs(createInteractionContext({ username: "peppy" }));

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.OSU);
        });
    });

    describe("mode priority", () => {
        test("neutral prefix aliases use saved config mode", async () => {
            linkedUsers.set("0000", { id: "0000", banchoId: "linked", mode: Mode.MANIA });

            const result = await parseCommandArgs(createPrefixContext(["peppy"], undefined, "top"));

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.MANIA);
        });

        test("neutral prefix aliases fall back to osu without saved config", async () => {
            const result = await parseCommandArgs(createPrefixContext(["peppy"], undefined, "top"));

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.OSU);
        });

        test("prefix fallback mode overrides saved config", async () => {
            linkedUsers.set("0000", { id: "0000", banchoId: "linked", mode: Mode.MANIA });

            const result = await parseCommandArgs(createPrefixContext(["peppy"], undefined, "topt"), Mode.TAIKO);

            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) expect(result.user.mode).toBe(Mode.TAIKO);
        });
    });
});
