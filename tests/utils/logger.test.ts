import { describe, expect, test } from "bun:test";
import { safeSerialize } from "../../src/utils/logger";

describe("logger serialization", () => {
    test("redacts sensitive keys and values, serializes BigInt, and handles circular values", () => {
        const context: Record<string, unknown> = {
            token: "super-secret-token",
            count: 90071992547409931234n,
            url: "mysql://user:password@example.com/db",
        };
        context.self = context;

        const serialized = safeSerialize(context);
        expect(serialized).toContain('"token":"[REDACTED]"');
        expect(serialized).toContain('"count":"90071992547409931234"');
        expect(serialized).toContain("[REDACTED]");
        expect(serialized).toContain("[Circular]");
    });
});
