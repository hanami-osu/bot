import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
    getEntry,
    insertData,
    removeEntry,
    getRowCount,
    bulkInsertData,
} from "../../src/utils/database";
import { Tables, EmbedScoreType } from "../../src/types/database";

describe("Database Utilities", () => {
    const TEST_USER_ID_1 = "test_user_999991";
    const TEST_USER_ID_2 = "test_user_999992";
    const TEST_GUILD_ID = "test_guild_888881";

    beforeAll(async () => {
        // Ensure clean state before tests
        (await removeEntry(Tables.USER, TEST_USER_ID_1));
        (await removeEntry(Tables.USER, TEST_USER_ID_2));
        (await removeEntry(Tables.GUILD, TEST_GUILD_ID));
    });

    afterAll(async () => {
        // Clean up test data after all tests
        (await removeEntry(Tables.USER, TEST_USER_ID_1));
        (await removeEntry(Tables.USER, TEST_USER_ID_2));
        (await removeEntry(Tables.GUILD, TEST_GUILD_ID));
    });

    describe("Single entry operations", () => {
        test("inserts and retrieves a user entry correctly", async () => {
            // Insert
            (await insertData({
                            table: Tables.USER,
                            id: TEST_USER_ID_1,
                            data: [
                                { key: "banchoId", value: "123456" },
                                { key: "embed_type", value: EmbedScoreType.Hanami },
                                { key: "mode", value: "osu" }
                            ]
                        }));

            // Retrieve
            const user = (await getEntry(Tables.USER, TEST_USER_ID_1));
            expect(user).not.toBeNull();
            expect(user?.id).toBe(TEST_USER_ID_1);
            expect(user?.banchoId).toBe("123456");
            expect(user?.embed_type).toBe(EmbedScoreType.Hanami);
            expect(user?.mode).toBe("osu");
        });

        test("updates an existing user entry correctly", async () => {
            // Update
            (await insertData({
                            table: Tables.USER,
                            id: TEST_USER_ID_1,
                            data: [
                                { key: "mode", value: "taiko" }
                            ]
                        }));

            // Retrieve
            const user = (await getEntry(Tables.USER, TEST_USER_ID_1));
            expect(user).not.toBeNull();
            expect(user?.banchoId).toBe("123456"); // Existing data should be preserved or overwritten depending on REPLACE logic
            // Note: SQLite REPLACE actually replaces the entire row, so banchoId might become null if not provided!
            // Let's check what actually happens in the db logic. The code uses an UPDATE statement if it exists.
            expect(user?.mode).toBe("taiko");
        });

        test("removes an entry correctly", async () => {
            (await removeEntry(Tables.USER, TEST_USER_ID_1));
            
            const user = (await getEntry(Tables.USER, TEST_USER_ID_1));
            expect(user).toBeNull();
        });
    });

    describe("JSON parsing in getEntry", () => {
        test("automatically parses JSON fields like guild prefixes", async () => {
            // Insert guild with stringified prefixes
            (await insertData({
                            table: Tables.GUILD,
                            id: TEST_GUILD_ID,
                            data: [
                                { key: "name", value: "Test Guild" },
                                { key: "owner_id", value: "owner_123" },
                                { key: "joined_at", value: new Date().toISOString() },
                                { key: "prefixes", value: JSON.stringify(["!", "?"]) }
                            ]
                        }));

            // Retrieve
            const guild = (await getEntry(Tables.GUILD, TEST_GUILD_ID));
            expect(guild).not.toBeNull();
            // It should be an array, parsed by getEntry
            expect(Array.isArray(guild?.prefixes)).toBe(true);
            expect(guild?.prefixes).toEqual(["!", "?"]);
        });
    });

    describe("Bulk operations", () => {
        test("bulk inserts multiple entries correctly", async () => {
            (await bulkInsertData([
                            {
                                table: Tables.USER,
                                id: TEST_USER_ID_1,
                                data: [{ key: "banchoId", value: "bulk_1" }]
                            },
                            {
                                table: Tables.USER,
                                id: TEST_USER_ID_2,
                                data: [{ key: "banchoId", value: "bulk_2" }]
                            }
                        ]));

            const user1 = (await getEntry(Tables.USER, TEST_USER_ID_1));
            const user2 = (await getEntry(Tables.USER, TEST_USER_ID_2));

            expect(user1?.banchoId).toBe("bulk_1");
            expect(user2?.banchoId).toBe("bulk_2");
        });
    });

    describe("Count operations", () => {
        test("getRowCount returns a number", async () => {
            const count = (await getRowCount(Tables.USER));
            expect(typeof count).toBe("number");
            expect(count).toBeGreaterThanOrEqual(2); // Since we just inserted 2 test users
        });
    });
});
