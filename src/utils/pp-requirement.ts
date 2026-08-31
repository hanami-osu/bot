import {
    calculateWhatIfProjection,
    MAX_WHATIF_PLAYS,
    MAX_WHATIF_PP,
    WhatIfValidationError,
    type WhatIfProjection,
} from "@utils/whatif";

export const MAX_PP_REQUIREMENT_PLAYS = MAX_WHATIF_PLAYS;

export interface PpRequirementInput {
    targetTotalPp: number;
    playPp?: number;
    playCount?: number;
}

export type PpRequirementResult
    = | {
        kind: "already_reached";
        targetTotalPp: number;
        currentTotalPp: number;
    }
    | {
        kind: "required_play_pp";
        targetTotalPp: number;
        playCount: number;
        requiredPlayPp: number;
        projection: WhatIfProjection;
    }
    | {
        kind: "required_play_count";
        targetTotalPp: number;
        playPp: number;
        playCount: number;
        projection: WhatIfProjection;
    }
    | {
        kind: "unreachable";
        targetTotalPp: number;
        playPp?: number;
        playCount?: number;
        maxProjection: WhatIfProjection;
    };

export class PpRequirementValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PpRequirementValidationError";
    }
}

function isValidPp(value: number): boolean {
    return Number.isFinite(value) && value > 0 && value <= MAX_WHATIF_PP;
}

function ceilToHundredths(value: number): number {
    return Math.ceil((value + Number.EPSILON) * 100) / 100;
}

function validateTarget(targetTotalPp: number): void {
    if (!isValidPp(targetTotalPp)) {
        throw new PpRequirementValidationError(`Target pp must be a positive number up to ${MAX_WHATIF_PP.toLocaleString()}pp.`);
    }
}

function validatePlayPp(playPp: number): void {
    if (!isValidPp(playPp)) {
        throw new PpRequirementValidationError(`Play pp must be a positive number up to ${MAX_WHATIF_PP.toLocaleString()}pp.`);
    }
}

function validatePlayCount(playCount: number): void {
    if (!Number.isInteger(playCount) || playCount < 1 || playCount > MAX_PP_REQUIREMENT_PLAYS) {
        throw new PpRequirementValidationError(`Play count must be a whole number between 1 and ${MAX_PP_REQUIREMENT_PLAYS}.`);
    }
}

function repeatedPlayPps(playPp: number, playCount: number): Array<number> {
    return Array.from({ length: playCount }, () => playPp);
}

export function calculatePpRequirement(
    currentTotalPp: number,
    currentPlayPps: Array<number>,
    input: PpRequirementInput,
): PpRequirementResult {
    const { targetTotalPp, playPp, playCount } = input;
    validatePpRequirementInput(input);

    if (targetTotalPp <= currentTotalPp) {
        return { kind: "already_reached", targetTotalPp, currentTotalPp };
    }

    if (typeof playPp !== "undefined") {
        return calculateRequiredPlayCount(currentTotalPp, currentPlayPps, targetTotalPp, playPp);
    }

    return calculateRequiredPlayPp(currentTotalPp, currentPlayPps, targetTotalPp, playCount ?? 1);
}

export function validatePpRequirementInput(input: PpRequirementInput): void {
    const { targetTotalPp, playPp, playCount } = input;
    validateTarget(targetTotalPp);

    if (typeof playPp !== "undefined" && typeof playCount !== "undefined") {
        throw new PpRequirementValidationError("Provide either a play pp value or a play count, not both.");
    }

    if (typeof playPp !== "undefined") validatePlayPp(playPp);
    if (typeof playCount !== "undefined") validatePlayCount(playCount);
}

function calculateRequiredPlayCount(
    currentTotalPp: number,
    currentPlayPps: Array<number>,
    targetTotalPp: number,
    playPp: number,
): PpRequirementResult {
    validatePlayPp(playPp);

    let maxProjection: WhatIfProjection | null = null;
    for (let playCount = 1; playCount <= MAX_PP_REQUIREMENT_PLAYS; playCount++) {
        const projection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, repeatedPlayPps(playPp, playCount));
        maxProjection = projection;

        if (projection.projectedTotalPp >= targetTotalPp) {
            return {
                kind: "required_play_count",
                targetTotalPp,
                playPp,
                playCount,
                projection,
            };
        }
    }

    if (maxProjection === null) {
        throw new WhatIfValidationError("Please provide at least one pp value.");
    }

    return { kind: "unreachable", targetTotalPp, playPp, maxProjection };
}

function calculateRequiredPlayPp(
    currentTotalPp: number,
    currentPlayPps: Array<number>,
    targetTotalPp: number,
    playCount: number,
): PpRequirementResult {
    validatePlayCount(playCount);

    const maxProjection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, repeatedPlayPps(MAX_WHATIF_PP, playCount));
    if (maxProjection.projectedTotalPp < targetTotalPp) {
        return { kind: "unreachable", targetTotalPp, playCount, maxProjection };
    }

    let low = 0;
    let high = MAX_WHATIF_PP;
    for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        const projection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, repeatedPlayPps(mid, playCount));
        if (projection.projectedTotalPp >= targetTotalPp) high = mid;
        else low = mid;
    }

    const requiredPlayPp = ceilToHundredths(high);
    const projection = calculateWhatIfProjection(currentTotalPp, currentPlayPps, repeatedPlayPps(requiredPlayPp, playCount));

    return {
        kind: "required_play_pp",
        targetTotalPp,
        playCount,
        requiredPlayPp,
        projection,
    };
}

export function parsePositivePpToken(token: string): number | null {
    const normalized = token.trim().replace(/pp$/i, "");
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

    const pp = Number(normalized);
    return isValidPp(pp) ? pp : null;
}

export function parsePpRequirementPrefixArgs(args: Array<string>): { input: PpRequirementInput; remainingArgs: Array<string> } {
    let targetTotalPp: number | undefined;
    let playPp: number | undefined;
    let playCount: number | undefined;
    const remainingArgs: Array<string> = [];

    for (const arg of args) {
        const flagMatch = /^(target|play|play_pp|pp|plays|count|n)=(.+)$/i.exec(arg);
        if (flagMatch) {
            const [, rawKey, rawValue] = flagMatch;
            const key = rawKey.toLowerCase();

            if (key === "plays" || key === "count" || key === "n") {
                const parsedCount = Number(rawValue);
                if (!Number.isInteger(parsedCount)) throw new PpRequirementValidationError("Play count must be a whole number.");
                playCount = parsedCount;
                continue;
            }

            const parsedPp = parsePositivePpToken(rawValue);
            if (parsedPp === null)
                throw new PpRequirementValidationError(`${key === "target" ? "Target pp" : "Play pp"} must be a positive pp value.`);

            if (key === "target") targetTotalPp = parsedPp;
            else playPp = parsedPp;
            continue;
        }

        const parsedPp = parsePositivePpToken(arg);
        if (parsedPp !== null && typeof targetTotalPp === "undefined") {
            targetTotalPp = parsedPp;
            continue;
        }

        if (parsedPp !== null && /pp$/i.test(arg) && typeof playPp === "undefined") {
            playPp = parsedPp;
            continue;
        }

        remainingArgs.push(arg);
    }

    if (typeof targetTotalPp === "undefined") {
        throw new PpRequirementValidationError("Please provide a target pp value.");
    }

    return { input: { targetTotalPp, playPp, playCount }, remainingArgs };
}
