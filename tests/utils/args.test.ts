import { expect, test, describe } from "bun:test";
import { parseOsuArguments, getCommandArgs } from "../../src/utils/args";
import { Mode } from "../../src/types/osu";
import { UserType } from "../../src/types/command-args";
import { Tables } from "../../src/types/database";
import { insertData, removeEntry } from "../../src/utils/database";

describe("args parser", () => {
    describe("parseOsuArguments (Prefix Commands)", () => {
        // Setup a dummy user in DB for tests
        const testDiscordId = "123456789012345678";
        const testBanchoId = "yorunoken";

        test("parses map link correctly", async () => {
            const message = { author: { id: testDiscordId } } as any;
            const args = ["https://osu.ppy.sh/b/72727"];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.beatmapId).toBe("72727");
        });

        test("parses map link with beatmapset correctly", async () => {
            const message = { author: { id: testDiscordId } } as any;
            const args = ["https://osu.ppy.sh/beatmapsets/123456#osu/72727"];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.beatmapId).toBe("72727");
        });

        test("parses explicit user string correctly", async () => {
            const message = { author: { id: "0000" } } as any; // Unregistered user
            const args = ["peppy"];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) {
                expect(result.user.banchoId).toBe("peppy");
            }
        });

        test("parses discord mention", async () => {
            // First we need to temporarily insert the user in the real db to test it without mocking
            (await insertData({ table: Tables.USER, id: testDiscordId, data: [{ key: "banchoId", value: testBanchoId }] }));

            const message = { author: { id: "0000" } } as any;
            const args = [`<@${testDiscordId}>`];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) {
                expect(result.user.banchoId).toBe(testBanchoId);
            }
            
            // Clean up
            (await removeEntry(Tables.USER, testDiscordId));
        });

        test("fails on unregistered discord mention", async () => {
            const unregisteredDiscordId = "999999999999999999";
            // Ensure they are not in the DB
            (await removeEntry(Tables.USER, unregisteredDiscordId));

            const message = { author: { id: "0000" } } as any;
            const args = [`<@${unregisteredDiscordId}>`];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.type).toBe(UserType.FAIL);
        });

        test("parses single string parameter correctly", async () => {
            const message = { author: { id: "0000" } } as any;
            const args = ['"mrekk"'];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) {
                expect(result.user.banchoId).toBe("mrekk");
            }
        });

        test("parses mods correctly", async () => {
            const message = { author: { id: "0000" } } as any;
            
            // +HDHR (include)
            let args = ["peppy", "+HDHR"];
            let result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.mods.include).toBe(true);
            expect(result.mods.name).toBe("HDHR");

            // +HDHR! (force include)
            args = ["peppy", "+HDHR!"];
            result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.mods.forceInclude).toBe(true);
            expect(result.mods.name).toBe("HDHR");

            // -HDHR! (exclude)
            args = ["peppy", "-HDHR!"];
            result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.mods.exclude).toBe(true);
            expect(result.mods.name).toBe("HDHR");
        });

        test("parses flags correctly", async () => {
            const message = { author: { id: "0000" } } as any;
            const args = ["peppy", "p=3", "-HDHR!"];
            
            const result = (await parseOsuArguments(message, args, Mode.OSU));
            expect(result.flags.p).toBe("3");
        });
    });

    describe("getCommandArgs (Slash Commands)", () => {
        const createMockInteraction = (options: Record<string, any>, userId = "0000") => {
            return {
                member: { user: { id: userId } },
                data: {
                    getString: (name: string) => options[name] ?? null,
                    getNumber: (name: string) => options[name] ?? null,
                    getUser: (name: string) => options[name] ?? null,
                    getBoolean: (name: string) => options[name] ?? null,
                }
            } as any;
        };

        test("parses mode, map, username, and mods", async () => {
            const interaction = createMockInteraction({
                username: "peppy",
                mode: Mode.TAIKO,
                map: "https://osu.ppy.sh/b/72727",
                mods: "HDHR",
                force_include: true,
            });

            const result = (await getCommandArgs(interaction));
            expect(result.user.type).toBe(UserType.SUCCESS);
            if (result.user.type === UserType.SUCCESS) {
                expect(result.user.banchoId).toBe("peppy");
                expect(result.user.mode).toBe(Mode.TAIKO);
                expect(result.user.beatmapId).toBe("72727");
            }

            expect(result.mods.name).toBe("HDHR");
            expect(result.mods.forceInclude).toBe(true);
        });

        test("parses difficulty attributes", async () => {
            const interaction = createMockInteraction({
                username: "peppy",
                bpm: 200,
                cs: 5,
            });

            const result = (await getCommandArgs(interaction, true));
            expect(result.difficultySettings).toBeDefined();
            expect(result.difficultySettings?.bpm).toBe(200);
            expect(result.difficultySettings?.cs).toBe(5);
        });
    });
});
