import { getEntry } from "./database";
import { Mode } from "@type/osu";
import { UserType } from "@type/command-args";
import { Tables } from "@type/database";
import { enums } from "osu-api-extended";
import type { SlashCommandArgs, DifficultyOptions, Mods, PrefixCommandArgs, User, CommandArgs } from "@type/command-args";
import type { CommandContext } from "./command-context";
import type { Mod } from "@type/mods";
import type { ApplicationCommandData, GuildInteraction, Message } from "@lilybird/transformers";
import { slashCommandIdsCache } from "./cache";

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

const init = "https://osu.ppy.sh/";
const index = init.length;
const name = "beatmapsets";
const nameLength = name.length;

function parseURL(url: string): BeatMapSetURL | BeatMapURL | null {
    if (!url.startsWith(init)) return null;
    if (url[index] !== "b") return null;

    if (url[index + 1] === "/") {
        return {
            url,
            id: url.substring(index + 2),
        };
    }

    if (!url.startsWith(name, index)) return null;
    const subUrl = url.substring(index + nameLength + 1);

    const slash = subUrl.indexOf("/");
    const hash = subUrl.indexOf("#");

    if (slash === -1) {
        if (hash === -1) {
            return {
                url,
                setId: subUrl,
                gameMode: null,
                difficultyId: null,
            };
        }

        return {
            url,
            setId: subUrl.substring(0, hash),
            gameMode: subUrl.substring(hash + 1),
            difficultyId: null,
        };
    }

    return {
        url,
        setId: subUrl.substring(0, hash),
        gameMode: subUrl.substring(hash + 1, slash),
        difficultyId: subUrl.substring(slash + 1),
    };
}

export async function getCommandArgs(interaction: GuildInteraction<ApplicationCommandData>, getAttributes?: boolean): Promise<SlashCommandArgs> {
    const { data, member } = interaction;

    // This is so fucking annoying holy shit I can't get it right
    let difficultySettings: DifficultyOptions | undefined;
    if (getAttributes === true) {
        const attributes: Array<keyof DifficultyOptions> = ["combo", "acc", "clock_rate", "bpm", "n300", "n100", "n50", "nmisses", "ngeki", "nkatu", "ar", "cs", "od"];
        difficultySettings = {} as DifficultyOptions;

        for (const attribute of attributes) {
            difficultySettings[attribute] = data.getNumber(attribute);
        }
    }

    const userArg = data.getString("username");
    const userAuthor = (await getEntry(Tables.USER, member.user.id));
    const discordUserId = data.getUser("discord");
    const discordUser = (await getEntry(Tables.USER, discordUserId ?? ""));
    const mode = (data.getString("mode") as Mode | undefined) ?? Mode.OSU;

    let mods: Mods = {
        exclude: null,
        include: null,
        forceInclude: null,
        name: null,
    };

    const modsValue = data.getString("mods");
    const modSections = modsValue?.toUpperCase().match(/.{1,2}/g);
    if (modSections && modSections.every((selectedMod) => selectedMod in enums.ModsEnum || modsValue === "NM")) {
        mods = {
            exclude: data.getBoolean("exclude") ?? null,
            include: data.getBoolean("include") ?? null,
            forceInclude: data.getBoolean("force_include") ?? null,
            name: (modsValue as Mod | undefined) ?? null,
        };
    }

    const urlMatch = parseURL(data.getString("map") ?? "");
    let beatmapId: string | null = null;
    if (urlMatch && "id" in urlMatch) beatmapId = urlMatch.id;
    else if (urlMatch && "setId" in urlMatch) beatmapId = urlMatch.difficultyId;

    const user: User = discordUserId
        ? discordUser?.banchoId
            ? { type: UserType.SUCCESS, banchoId: discordUser.banchoId, authorDb: userAuthor, mode, beatmapId }
            : {
                  type: UserType.FAIL,
                  beatmapId,
                  authorDb: userAuthor,
                  failMessage: discordUserId ? `The user <@${discordUserId}> hasn't linked their account to the bot yet!` : `Please link your account to the bot using ${slashCommandIdsCache.get("link")}!`,
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
            failMessage: `Please link your account to the bot using ${slashCommandIdsCache.get("link")}!`,
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
        const parsedUrl = parseURL(arg);
        if (parsedUrl !== null) mapLinkMatches.push(parsedUrl);
    }

    if (mapLinkMatches.length > 0) {
        // Get the first array of `mapLinkMatches`
        const [firstMatch] = mapLinkMatches;

        // Extract beatmap ID from link
        const beatmapId = "id" in firstMatch ? firstMatch.id : firstMatch.difficultyId;
        result.user.beatmapId = beatmapId;

        // Remove the map link from args array
        const indexToRemove = args.findIndex((link) => link === firstMatch.url);
        args.splice(indexToRemove, 1);
    }

    const newArgs = args.join(" ").match(/(".*?"|\S+)/g) ?? [];
    for (const arg of newArgs) {
        if (arg.includes('"')) {
            (result.tempUser ??= []).push(arg.replace(/"/g, ""));
            continue;
        }

        const [key, value] = arg.split("=");
        const [, modType, mod, force] = /^([+-])([A-Za-z]+)(!)?$/.exec(arg) ?? [];

        if (mod) {
            const modSections = /.{1,2}/g.exec(mod);

            // Make sure `mod` is an actual mod in osu!
            if (modSections && !modSections.every((selectedMod) => selectedMod.toUpperCase() in enums.ModsEnum || mod.toUpperCase() === "NM")) continue;

            result.mods.include = modType !== "-";
            result.mods.exclude = modType === "-" && typeof force !== "undefined";
            result.mods.forceInclude = modType === "+" && typeof force !== "undefined";
            if (result.mods.include || result.mods.exclude || result.mods.forceInclude) {
                result.mods.name = mod.replaceAll(/\+|!|-/g, "").toUpperCase();
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

    const userAuthor = (await getEntry(Tables.USER, message.author.id));

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
        const discordUser = discordUserId ? (await getEntry(Tables.USER, discordUserId)) : null;
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
        const slashArgs = (await getCommandArgs(ctx.interaction!, getAttributes));
        const flags: Record<string, string | undefined> = {};
        
        const options = (ctx.interaction!.data as any).options ?? [];
        for (const opt of options) {
            if (opt.value !== undefined && opt.value !== null) {
                flags[opt.name] = String(opt.value);
            }
        }
        
        // Emulate some flags like `-p` for interactions
        if (flags["page"]) flags["p"] = flags["page"];
        
        // Also map mods_action to specific flag behavior if necessary, but mods are handled in slashArgs.mods
        return { ...slashArgs, flags };
    } else {
        const prefixArgs = (await parseOsuArguments(ctx.message!, ctx.args, mode));
        return { ...prefixArgs };
    }
}
