import { enums } from "osu-api-extended";
import type { Mods } from "@type/command-args";

const allowedModAcronyms = new Set(Object.keys(enums.ModsEnum));
const equivalentMods = [
    ["DT", "NC"],
    ["SD", "PF"],
    ["HT", "DC"],
] as const;

export class CommandValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommandValidationError";
    }
}

export function normalizeStringOption(value: string | null | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().replace(/^"(.*)"$/, "$1");
    return normalized.length > 0 ? normalized : undefined;
}

export function parseModsString(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = value.toUpperCase();
    if (normalized === "NM") return null;
    if (!/^[A-Z0-9]+$/.test(normalized) || normalized.length % 2 !== 0) {
        throw new CommandValidationError("The mods value must be a valid two-letter mod combination.");
    }
    const sections: Array<string> = normalized.match(/.{1,2}/g) ?? [];
    if (!sections.every((mod) => allowedModAcronyms.has(mod)))
        throw new CommandValidationError("The mods value contains an unknown mod.");
    if (new Set(sections).size !== sections.length) throw new CommandValidationError("The mods value contains duplicate mods.");
    for (const [first, second] of equivalentMods) {
        if (sections.includes(first) && sections.includes(second))
            throw new CommandValidationError(`${first} and ${second} cannot be used together.`);
    }
    return normalized;
}

export function buildMods(name: string | null, action?: string | null): Mods {
    const mods: Mods = { exclude: null, include: null, forceInclude: null, name };
    if (!name) return mods;
    switch (action ?? "include") {
        case "include":
            mods.include = true;
            break;
        case "force_include":
            mods.forceInclude = true;
            break;
        case "exclude":
            mods.exclude = true;
            break;
        default:
            throw new CommandValidationError("The mods action is invalid.");
    }
    return mods;
}

export function parsePrefixIntegerFlag(value: string | undefined, label: string, min: number, max?: number): number | undefined {
    if (typeof value === "undefined") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new CommandValidationError(`${label} must be a whole number.`);
    if (parsed < min || (typeof max !== "undefined" && parsed > max)) {
        throw new CommandValidationError(
            typeof max === "undefined" ? `${label} must be at least ${min}.` : `${label} must be between ${min} and ${max}.`,
        );
    }
    return parsed;
}

export function parsePrefixPageFlag(flags: Record<string, string | undefined>, max?: number): number | undefined {
    const page = parsePrefixIntegerFlag(flags.page ?? flags.p, "page", 1, max);
    return typeof page === "undefined" ? undefined : page - 1;
}

export function parseSlashIntegerOption(value: number | null | undefined, label: string): number | undefined {
    if (value === null || typeof value === "undefined") return undefined;
    if (!Number.isInteger(value)) throw new CommandValidationError(`${label} must be a whole number.`);
    if (value < 1) throw new CommandValidationError(`${label} must be at least 1.`);
    return value - 1;
}
