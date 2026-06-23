import { getEntry } from "./database";
import { Mode } from "@type/osu";
import { UserType } from "@type/command-args";
import { Tables } from "@type/database";
import { enums } from "osu-api-extended";
import type { SlashCommandArgs, DifficultyOptions, Mods, PrefixCommandArgs, User, CommandArgs } from "@type/command-args";
import type { CommandContext } from "./command-context";
import type { ApplicationCommandData, DMInteraction, GuildInteraction, Interaction, Message } from "@lilybird/transformers";
import { getSlashCommandMention } from "../state/command-registry";

interface BeatMapSetURL {
    url: string;
    setId: string;
    gameMode: string | null;
    difficultyId: string | null;
}

interface BeatMapURL {
    url: string;
    id: string;
}

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

function isDecimalInteger(value: string): boolean {
    return /^\d+$/.test(value);
}

export function parseBeatmapUrl(url: string): BeatMapSetURL | BeatMapURL | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    if (parsed.protocol !== "https:" || parsed.hostname !== "osu.ppy.sh") return null;

    const path = parsed.pathname.replace(/\/+$/, "");
    const legacyBeatmap = /^\/b\/(\d+)$/.exec(path);
    if (legacyBeatmap) return { url, id: legacyBeatmap[1] };

    const beatmap = /^\/beatmaps\/(\d+)$/.exec(path);
    if (beatmap) return { url, id: beatmap[1] };

    const beatmapset = /^\/beatmapsets\/(\d+)$/.exec(path);
    if (!beatmapset) return null;

    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "";
    if (!hash) {
        return { url, setId: beatmapset[1], gameMode: null, difficultyId: null };
    }

    const [gameMode, difficultyId] = hash.split("/");
    if (!gameMode || !difficultyId || !isDecimalInteger(difficultyId)) return null;

    return { url, setId: beatmapset[1], gameMode, difficultyId };
}

function parseModsString(modsValue: string | null | undefined): string | null {
    if (!modsValue) return null;

    const normalized = modsValue.toUpperCase();
    if (normalized === "NM") return null;
    if (!/^[A-Z0-9]+$/.test(normalized) || normalized.length % 2 !== 0) {
        throw new CommandValidationError("The mods value must be a valid two-letter mod combination.");
    }

    const sections: Array<string> = normalized.match(/.{1,2}/g) ?? [];
    if (!sections.every((selectedMod) => allowedModAcronyms.has(selectedMod))) {
        throw new CommandValidationError("The mods value contains an unknown mod.");
    }

    if (new Set(sections).size !== sections.length) {
        throw new CommandValidationError("The mods value contains duplicate mods.");
    }

    for (const [first, second] of equivalentMods) {
        if (sections.includes(first) && sections.includes(second)) {
            throw new CommandValidationError(`${first} and ${second} cannot be used together.`);
        }
    }

    return normalized;
}

function buildMods(name: string | null, action?: string | null): Mods {
    const mods: Mods = {
        exclude: null,
        include: null,
        forceInclude: null,
        name,
    };

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
    if (!Number.isInteger(parsed)) {
        throw new CommandValidationError(`${label} must be a whole number.`);
    }

    if (parsed < min || (typeof max !== "undefined" && parsed > max)) {
        throw new CommandValidationError(typeof max === "undefined" ? `${label} must be at least ${min}.` : `${label} must be between ${min} and ${max}.`);
    }

    return parsed;
}

export function parsePrefixPageFlag(flags: Record<string, string | undefined>, max?: number): number | undefined {
    const page = parsePrefixIntegerFlag(flags.page ?? flags.p, "page", 1, max);
    return typeof page === "undefined" ? undefined : page - 1;
}

function getBeatmapId(urlMatch: BeatMapSetURL | BeatMapURL | null): string | null {
    if (!urlMatch) return null;
    return "id" in urlMatch ? urlMatch.id : urlMatch.difficultyId;
}

type SlashOptionValue = string | number | boolean;
interface SlashOption {
    name: string;
    value?: SlashOptionValue | null;
}

interface SlashDataWithOptions {
    options?: Array<SlashOption>;
}

function getSlashOptions(data: ApplicationCommandData): Array<SlashOption> {
    if (!("options" in data)) return [];
    const { options } = data as ApplicationCommandData & SlashDataWithOptions;
    return Array.isArray(options) ? options : [];
}

function isGuildInteraction(interaction: Interaction<ApplicationCommandData>): interaction is GuildInteraction<ApplicationCommandData> {
    return typeof interaction.inGuild === "function" ? interaction.inGuild() : "member" in interaction;
}

function isDMInteraction(interaction: Interaction<ApplicationCommandData>): interaction is DMInteraction<ApplicationCommandData> {
    return typeof interaction.inDM === "function" ? interaction.inDM() : "user" in interaction;
}

function getInteractionUserId(interaction: Interaction<ApplicationCommandData>): string {
    if (isGuildInteraction(interaction)) return interaction.member.user.id;
    if (isDMInteraction(interaction)) return interaction.user.id;
    throw new Error("Interaction command context is missing user data");
}

export async function getCommandArgs(interaction: Interaction<ApplicationCommandData>, getAttributes?: boolean): Promise<SlashCommandArgs> {
    const { data } = interaction;

    // This is so fucking annoying holy shit I can't get it right
    let difficultySettings: DifficultyOptions | undefined;
    if (getAttributes === true) {
        const attributes: Array<keyof DifficultyOptions> = ["combo", "acc", "clock_rate", "bpm", "n300", "n100", "n50", "nmisses", "ngeki", "nkatu", "ar", "cs", "od"];
        difficultySettings = {} as DifficultyOptions;

        for (const attribute of attributes) {
            const value = data.getNumber(attribute);
            if (value !== null && value !== undefined) difficultySettings[attribute] = value;
        }
    }

    const userArg = data.getString("username");
    const userAuthor = await getEntry(Tables.USER, getInteractionUserId(interaction));
    const discordUserId = data.getUser("discord");
    const discordUser = await getEntry(Tables.USER, discordUserId ?? "");
    const mode = (data.getString("mode") as Mode | undefined) ?? Mode.OSU;

    const modsValue = data.getString("mods");
    const modsAction = data.getString("mods_action") ?? (data.getBoolean("force_include") ? "force_include" : data.getBoolean("exclude") ? "exclude" : data.getBoolean("include") ? "include" : null);
    const mods = buildMods(parseModsString(modsValue), modsAction);

    const beatmapId = getBeatmapId(parseBeatmapUrl(data.getString("map") ?? ""));

    const user: User = discordUserId
        ? discordUser?.banchoId
            ? { type: UserType.SUCCESS, banchoId: discordUser.banchoId, authorDb: userAuthor, mode, beatmapId }
            : {
                  type: UserType.FAIL,
                  beatmapId,
                  authorDb: userAuthor,
                  failMessage: discordUserId ? `The user <@${discordUserId}> hasn't linked their account to the bot yet!` : `Please link your account to the bot using ${getSlashCommandMention("link")}!`,
              }
        : userArg
          ? { type: UserType.SUCCESS, banchoId: userArg, mode, beatmapId, authorDb: userAuthor }
          : userAuthor?.banchoId
            ? { type: UserType.SUCCESS, banchoId: userAuthor.banchoId, mode, beatmapId, authorDb: userAuthor }
            : { type: UserType.FAIL, beatmapId, authorDb: userAuthor, failMessage: "Please link your account to the bot using /link!" };

    return { user, mods, difficultySettings };
}

export async function parseOsuArguments(message: Message, args: Array<string>, mode: Mode): Promise<PrefixCommandArgs> {
    const result: PrefixCommandArgs = {
        tempUser: null,
        user: {
            beatmapId: null,
            type: UserType.FAIL,
            failMessage: `Please link your account to the bot using ${getSlashCommandMention("link")}!`,
            authorDb: null,
        },
        flags: {},
        mods: {
            exclude: null,
            include: null,
            forceInclude: null,
            name: null,
        },
    };

    const mapLinkMatches: Array<BeatMapSetURL | BeatMapURL> = [];
    for (const arg of args) {
        const parsedUrl = parseBeatmapUrl(arg);
        if (parsedUrl !== null) mapLinkMatches.push(parsedUrl);
    }

    if (mapLinkMatches.length > 0) {
        // Get the first array of `mapLinkMatches`
        const [firstMatch] = mapLinkMatches;

        // Extract beatmap ID from link
        result.user.beatmapId = getBeatmapId(firstMatch);

        // Remove the map link from args array
        const indexToRemove = args.findIndex((link) => link === firstMatch.url);
        args.splice(indexToRemove, 1);
    }

    const newArgs = args.join(" ").match(/(?:[^\s="]+=".*?"|".*?"|\S+)/g) ?? [];
    for (const arg of newArgs) {
        const flagMatch = /^([^=\s]+)=(.*)$/.exec(arg);
        if (flagMatch) {
            const [, key, rawValue] = flagMatch;
            result.flags[key] = rawValue.replace(/^"(.*)"$/, "$1");
            continue;
        }

        if (arg.includes('"')) {
            (result.tempUser ??= []).push(arg.replace(/"/g, ""));
            continue;
        }

        const [key, value] = arg.split("=");
        const [, modType, mod, force] = /^([+-])([A-Za-z0-9]+)(!)?$/.exec(arg) ?? [];

        if (mod) {
            const parsedMods = parseModsString(mod);

            result.mods.include = typeof force === "undefined";
            result.mods.exclude = modType === "-" && typeof force !== "undefined";
            result.mods.forceInclude = modType === "+" && typeof force !== "undefined";
            if (result.mods.include || result.mods.exclude || result.mods.forceInclude) {
                result.mods.name = parsedMods;
                continue;
            }
        }

        // Check if it's a username
        if (key && !value) {
            (result.tempUser ??= []).push(key);
            continue;
        }

        //  Check if it's a "=" value
        if (key && value) result.flags[key] = value;
    }

    const userAuthor = await getEntry(Tables.USER, message.author.id);

    if (!result.tempUser && userAuthor?.banchoId) {
        result.user = {
            beatmapId: result.user.beatmapId,
            type: UserType.SUCCESS,
            banchoId: userAuthor.banchoId,
            authorDb: userAuthor,
            mode,
        };
    } else if (result.tempUser) {
        const [userArg] = result.tempUser;

        const discordUserId = /<@(\d+)>/.exec(userArg)?.[1];
        const discordUser = discordUserId ? await getEntry(Tables.USER, discordUserId) : null;
        const discordId = discordUserId ? discordUser?.banchoId : null;

        if (discordUserId && !discordId) {
            result.user = {
                beatmapId: result.user.beatmapId,
                type: UserType.FAIL,
                authorDb: userAuthor,
                failMessage: `The user <@${discordUserId}> hasn't linked their account to the bot yet!`,
            };
        } else {
            result.user = {
                beatmapId: result.user.beatmapId,
                type: UserType.SUCCESS,
                banchoId: discordId ?? userArg,
                authorDb: userAuthor,
                mode,
            };
        }
    }

    return result;
}

export async function parseCommandArgs(ctx: CommandContext, mode: Mode = Mode.OSU, getAttributes?: boolean): Promise<CommandArgs> {
    if (ctx.isInteraction) {
        if (!ctx.interaction) throw new Error("Interaction command context is missing interaction data");
        const slashArgs = await getCommandArgs(ctx.interaction, getAttributes);
        const flags: Record<string, string | undefined> = {};

        const options = getSlashOptions(ctx.interaction.data);
        for (const opt of options) {
            if (opt.value !== undefined && opt.value !== null) {
                // incase someone tries to put it in quotes
                flags[opt.name] = String(opt.value)
                    .trim()
                    .replace(/^"(.*)"$/, "$1");
            }
        }

        // Emulate some flags like `-p` for interactions
        if (flags["page"]) flags["p"] = flags["page"];

        return { ...slashArgs, flags };
    } else {
        if (!ctx.message) throw new Error("Message command context is missing message data");
        const prefixArgs = await parseOsuArguments(ctx.message, ctx.args, mode);
        return { ...prefixArgs };
    }
}
