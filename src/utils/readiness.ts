import { rm, writeFile } from "fs/promises";
import { logger } from "./logger";

export const MAX_READY_AGE_MS = 5 * 60 * 1000;
export const READY_FILE = process.env.HANAMI_READY_FILE ?? "/tmp/hanami-ready";

async function writeReadyFile() {
    try {
        await writeFile(READY_FILE, Date.now().toString(), "utf8");
    } catch (error) {
        logger.error("Failed to update ready file", error as Error);
    }
}

export async function markReady(): Promise<void> {
    await writeReadyFile();
    setInterval(writeReadyFile, MAX_READY_AGE_MS / 2);
}

export async function clearReady(): Promise<void> {
    await rm(READY_FILE, { force: true });
}
