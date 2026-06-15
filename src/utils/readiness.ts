import { rm, writeFile } from "fs/promises";

export const READY_FILE = process.env.HANAMI_READY_FILE ?? "/tmp/hanami-ready";

export async function markReady(): Promise<void> {
    await writeFile(READY_FILE, Date.now().toString(), "utf8");
}

export async function clearReady(): Promise<void> {
    await rm(READY_FILE, { force: true });
}
