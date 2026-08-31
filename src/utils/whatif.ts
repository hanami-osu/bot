import { Mode } from "@type/osu";

const PP_DECAY = 0.95;
const OSU_DAILY_PP_ENDPOINT = "https://osudaily.net/api/pp.php";
const RANK_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_WHATIF_PLAYS = 100;
export const MAX_WHATIF_PP = 100000;

const osuDailyModeIds: Record<Mode, number> = {
    [Mode.OSU]: 0,
    [Mode.TAIKO]: 1,
    [Mode.FRUITS]: 2,
    [Mode.MANIA]: 3,
};

const rankCache = new Map<string, { rank: number; expiresAt: number }>();

export interface WhatIfProjection {
    currentTotalPp: number;
    currentWeightedPp: number;
    currentBonusPp: number;
    projectedTotalPp: number;
    projectedWeightedPp: number;
    ppGain: number;
    playPps: Array<number>;
}

export class WhatIfValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WhatIfValidationError";
    }
}

function isValidPpValue(value: number): boolean {
    return Number.isFinite(value) && value > 0 && value <= MAX_WHATIF_PP;
}

function parsePpToken(token: string): number | null {
    const normalized = token.trim().replace(/pp$/i, "");
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

    const pp = Number(normalized);
    return isValidPpValue(pp) ? pp : null;
}

export function parseWhatIfPlayPps(input: string): Array<number> {
    const tokens = input
        .split(/[,\s]+/)
        .map(token => token.trim())
        .filter(Boolean);

    if (tokens.length === 0) {
        throw new WhatIfValidationError("Please provide at least one pp value.");
    }

    if (tokens.length > MAX_WHATIF_PLAYS) {
        throw new WhatIfValidationError(`Please provide ${MAX_WHATIF_PLAYS} or fewer pp values.`);
    }

    const playPps = tokens.map(token => parsePpToken(token));
    if (playPps.some(pp => pp === null)) {
        throw new WhatIfValidationError(`PP values must be positive numbers up to ${MAX_WHATIF_PP.toLocaleString()}pp.`);
    }

    return playPps as Array<number>;
}

export function extractWhatIfPlayPps(args: Array<string>): { playPps: Array<number>; remainingArgs: Array<string> } {
    const playPps: Array<number> = [];
    const remainingArgs: Array<string> = [];

    for (const arg of args) {
        const tokens = arg
            .split(",")
            .map(token => token.trim())
            .filter(Boolean);

        if (tokens.length > 0) {
            const parsedTokens = tokens.map(token => parsePpToken(token));
            if (parsedTokens.every(pp => pp !== null)) {
                playPps.push(...(parsedTokens as Array<number>));
                continue;
            }
        }

        remainingArgs.push(arg);
    }

    if (playPps.length > MAX_WHATIF_PLAYS) {
        throw new WhatIfValidationError(`Please provide ${MAX_WHATIF_PLAYS} or fewer pp values.`);
    }

    return { playPps, remainingArgs };
}

export function calculateWeightedPp(playPps: Array<number>): number {
    return [...playPps]
        .sort((a, b) => b - a)
        .slice(0, 100)
        .reduce((total, pp, index) => total + pp * Math.pow(PP_DECAY, index), 0);
}

export function calculateWhatIfProjection(
    currentTotalPp: number,
    currentPlayPps: Array<number>,
    playPps: Array<number>,
): WhatIfProjection {
    if (playPps.length === 0) throw new WhatIfValidationError("Please provide at least one pp value.");
    if (playPps.length > MAX_WHATIF_PLAYS) throw new WhatIfValidationError(`Please provide ${MAX_WHATIF_PLAYS} or fewer pp values.`);
    if (!playPps.every(isValidPpValue))
        throw new WhatIfValidationError(`PP values must be positive numbers up to ${MAX_WHATIF_PP.toLocaleString()}pp.`);

    const rankedCurrentPps = currentPlayPps.filter(isValidPpValue);
    const currentWeightedPp = calculateWeightedPp(rankedCurrentPps);
    const currentBonusPp = Math.max(0, currentTotalPp - currentWeightedPp);
    const projectedWeightedPp = calculateWeightedPp([...rankedCurrentPps, ...playPps]);
    const projectedTotalPp = projectedWeightedPp + currentBonusPp;

    return {
        currentTotalPp,
        currentWeightedPp,
        currentBonusPp,
        projectedTotalPp,
        projectedWeightedPp,
        ppGain: Math.max(0, projectedTotalPp - currentTotalPp),
        playPps,
    };
}

interface OsuDailyPpResponse {
    rank?: string | number;
    pp?: string | number;
    error?: unknown;
}

function parseRank(value: string | number | undefined): number | null {
    const rank = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export function clearWhatIfRankCache(): void {
    rankCache.clear();
}

export async function estimateGlobalRankFromPp(targetPp: number, mode: Mode): Promise<number | null> {
    const apiKey = process.env.OSU_DAILY_API;
    if (!apiKey || !isValidPpValue(targetPp)) return null;

    const cacheKey = `${mode}:${targetPp.toFixed(3)}`;
    const cachedRank = rankCache.get(cacheKey);
    if (cachedRank && cachedRank.expiresAt > Date.now()) return cachedRank.rank;

    const url = new URL(OSU_DAILY_PP_ENDPOINT);
    url.searchParams.set("k", apiKey);
    url.searchParams.set("t", "pp");
    url.searchParams.set("v", targetPp.toFixed(3));
    url.searchParams.set("m", String(osuDailyModeIds[mode]));

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = (await response.json()) as OsuDailyPpResponse;
        if (data.error) return null;

        const rank = parseRank(data.rank);
        if (rank === null) return null;

        rankCache.set(cacheKey, { rank, expiresAt: Date.now() + RANK_CACHE_TTL_MS });
        return rank;
    } catch {
        return null;
    }
}
