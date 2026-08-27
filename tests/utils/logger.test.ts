import { describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Logger, safeSerialize } from "../../src/utils/logger";

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

    test("redacts sensitive values from error messages and stack traces", async () => {
        const logDir = await mkdtemp(join(tmpdir(), "hanami-logger-"));

        try {
            const logger = new Logger({ logDir, enableConsole: false, enableFile: true });
            const bearerToken = "Bearer fake.secret-token_123";
            const mysqlUrl = "mysql://hanami:fake-password@db.example.com/hanami";
            const redisUrl = "redis://:fake-password@redis.example.com:6379/0";
            const error = new Error(`upstream failed with ${bearerToken}; ${mysqlUrl}; ${redisUrl}`);

            await logger.error("Synthetic failure", error);
            await logger.flush();

            const [logFile] = await readdir(logDir);
            const contents = await readFile(join(logDir, logFile), "utf8");

            expect(contents).not.toContain(bearerToken);
            expect(contents).not.toContain(mysqlUrl);
            expect(contents).not.toContain(redisUrl);
            expect(contents).toContain("[REDACTED]");
        } finally {
            await rm(logDir, { recursive: true, force: true });
        }
    });

    test("redacts sensitive values from primary log messages", async () => {
        const logDir = await mkdtemp(join(tmpdir(), "hanami-logger-"));
        const originalConsoleError = console.error;
        const consoleError = mock((..._args: Array<unknown>) => undefined);
        console.error = consoleError;

        try {
            const logger = new Logger({ logDir, enableConsole: true, enableFile: true });
            const bearerToken = "Bearer fake.primary-message-token_123";

            await logger.error(`Request failed with ${bearerToken}`);
            await logger.flush();

            const [logFile] = await readdir(logDir);
            const contents = await readFile(join(logDir, logFile), "utf8");
            const consoleOutput = String(consoleError.mock.calls[0]?.[0] ?? "");

            expect(contents).not.toContain(bearerToken);
            expect(consoleOutput).not.toContain(bearerToken);
            expect(contents).toContain("[REDACTED]");
            expect(consoleOutput).toContain("[REDACTED]");
        } finally {
            console.error = originalConsoleError;
            await rm(logDir, { recursive: true, force: true });
        }
    });
});
