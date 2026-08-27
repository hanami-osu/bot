import { mkdir, appendFile, access, readdir, unlink } from "fs/promises";
import { join } from "path";

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: Error;
}

interface LoggerConfig {
    level: LogLevel;
    logDir: string;
    maxFiles: number;
    dateFormat: string;
    enableConsole: boolean;
    enableFile: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
    level: LogLevel.INFO,
    logDir: process.env.LOG_DIR ?? "./logs",
    maxFiles: 30,
    dateFormat: "YYYY-MM-DD",
    enableConsole: true,
    enableFile: true,
};

const SENSITIVE_KEY_PATTERN = /(token|authorization|cookie|password|secret|database_url|session)/i;
const SENSITIVE_VALUE_PATTERN =
    /(Bearer\s+[A-Za-z0-9._-]+|mysql:\/\/\S+|postgres(?:ql)?:\/\/\S+|redis:\/\/\S+|[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,})/gi;

function redactString(value: string): string {
    return value.replace(SENSITIVE_VALUE_PATTERN, "[REDACTED]");
}

export function safeSerialize(value: unknown): string {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (key, nestedValue: unknown) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";
        if (typeof nestedValue === "bigint") return nestedValue.toString();
        if (typeof nestedValue === "string") return redactString(nestedValue);
        if (typeof nestedValue === "object" && nestedValue !== null) {
            if (seen.has(nestedValue)) return "[Circular]";
            seen.add(nestedValue);
        }
        return nestedValue;
    });
}

export class Logger {
    private config: LoggerConfig;
    private currentLogFile: string | null = null;
    private writeQueue: Array<string> = [];
    private isWriting = false;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    private getLevelName(level: LogLevel): string {
        const names = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
        return names[level] ?? "UNKNOWN";
    }

    private getColorCode(level: LogLevel): string {
        const colors = ["\x1b[36m", "\x1b[32m", "\x1b[33m", "\x1b[31m", "\x1b[35m"];
        return colors[level] ?? "\x1b[0m";
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(entry: LogEntry): string {
        const message = redactString(entry.message);
        const contextStr = entry.context ? ` | Context: ${safeSerialize(entry.context)}` : "";
        const errorStr = entry.error ? ` | Error: ${redactString(entry.error.stack || entry.error.message)}` : "";
        return `[${entry.timestamp}] [${this.getLevelName(entry.level)}] ${message}${contextStr}${errorStr}`;
    }

    private formatConsoleMessage(entry: LogEntry): string {
        const colorCode = this.getColorCode(entry.level);
        const resetCode = "\x1b[0m";
        const levelName = this.getLevelName(entry.level).padEnd(5);
        const message = redactString(entry.message);
        const contextStr = entry.context ? ` | ${safeSerialize(entry.context)}` : "";
        const errorStr = entry.error ? ` | ${redactString(entry.error.message)}` : "";

        return `${colorCode}[${entry.timestamp}] [${levelName}]${resetCode} ${message}${contextStr}${errorStr}`;
    }

    private async getCurrentLogFile(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format
        const fileName = `${dateStr}.log`;
        const filePath = join(this.config.logDir, fileName);

        if (this.currentLogFile !== filePath) {
            await this.ensureLogDirectory();
            await this.cleanOldLogs();
            this.currentLogFile = filePath;
        }

        return filePath;
    }

    private async ensureLogDirectory(): Promise<void> {
        try {
            await access(this.config.logDir);
        } catch {
            await mkdir(this.config.logDir, { recursive: true });
        }
    }

    private async cleanOldLogs(): Promise<void> {
        try {
            const files = await readdir(this.config.logDir);
            const logFiles = files
                .filter((file) => file.endsWith(".log"))
                .map((file) => ({
                    name: file,
                    path: join(this.config.logDir, file),
                }))
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first

            if (logFiles.length > this.config.maxFiles) {
                const filesToDelete = logFiles.slice(this.config.maxFiles);
                for (const file of filesToDelete) {
                    await unlink(file.path);
                }
            }
        } catch (error) {
            console.error("Failed to clean old log files:", error);
        }
    }

    private async processWriteQueue(): Promise<void> {
        if (this.isWriting || this.writeQueue.length === 0) {
            return;
        }

        this.isWriting = true;
        const entries = this.writeQueue.splice(0);

        try {
            const logFile = await this.getCurrentLogFile();
            const content = entries.join("\n") + "\n";
            await appendFile(logFile, content, "utf8");
        } catch (error) {
            // If file writing fails, output to console at least
            console.error("Failed to write to log file:", error);
        } finally {
            this.isWriting = false;
            // Process any new entries that came in while we were writing
            if (this.writeQueue.length > 0) {
                setImmediate(() => this.processWriteQueue());
            }
        }
    }

    private async log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): Promise<void> {
        if (level < this.config.level) {
            return;
        }

        const entry: LogEntry = {
            timestamp: this.formatTimestamp(),
            level,
            message,
            context,
            error,
        };

        // Console output
        if (this.config.enableConsole) {
            const consoleMessage = this.formatConsoleMessage(entry);
            if (level >= LogLevel.ERROR) {
                console.error(consoleMessage);
            } else {
                console.log(consoleMessage);
            }
        }

        // File output
        if (this.config.enableFile) {
            const fileMessage = this.formatMessage(entry);
            this.writeQueue.push(fileMessage);
            setImmediate(() => this.processWriteQueue());
        }
    }

    debug(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.log(LogLevel.WARN, message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>): Promise<void> {
        return this.log(LogLevel.ERROR, message, context, error);
    }

    fatal(message: string, error?: Error, context?: Record<string, unknown>): Promise<void> {
        return this.log(LogLevel.FATAL, message, context, error);
    }

    // Flush any pending writes
    async flush(): Promise<void> {
        while (this.writeQueue.length > 0 || this.isWriting) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
}

export const logger = new Logger();
