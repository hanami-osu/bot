import { describe, expect, test } from "bun:test";

describe("integration test harness", () => {
    test("is available for disposable service tests", () => {
        expect(true).toBe(true);
    });
});
