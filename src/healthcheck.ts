import { stat } from "fs/promises";
import { READY_FILE } from "@utils/readiness";

export const MAX_READY_AGE_MS = 5 * 60 * 1000;

try {
    const readyFile = await stat(READY_FILE);
    const ageMs = Date.now() - readyFile.mtimeMs;
    if (ageMs > MAX_READY_AGE_MS) {
        console.error(`Readiness marker is stale: ${Math.round(ageMs / 1000)}s old`);
        process.exit(1);
    }
    process.exit(0);
} catch (error) {
    console.error("Readiness marker is missing", error);
    process.exit(1);
}
