import { USER_SCORE_FETCH_LIMIT } from "../providers/score-provider";
import { ITEMS_PER_PAGE } from "./pagination";
import { identityService } from "../services/identity-service";
import { parsePrefixCommandOptions } from "../parsing/prefix-command-args";
import { parseSlashCommandOptions } from "../parsing/slash-command-args";
import { CommandValidationError, parsePrefixIntegerFlag, parsePrefixPageFlag } from "../parsing/command-options";
import { parseBeatmapUrl } from "../parsing/beatmap-url";
import type { CommandArgs } from "@type/command-args";
import type { Mode } from "@type/osu";
import type { CommandContext } from "./command-context";

export { CommandValidationError, parseBeatmapUrl, parsePrefixIntegerFlag, parsePrefixPageFlag };

export function validatePage(page: number | undefined): void {
    const maxPage = Math.ceil(USER_SCORE_FETCH_LIMIT / ITEMS_PER_PAGE);
    if (typeof page !== "undefined" && page + 1 > maxPage) {
        throw new CommandValidationError(`page must be between 1 and ${maxPage}.`);
    }
}

/** Command-facing compatibility entry point. Parsing stays pure; identity resolution is delegated to the service. */
export function createCommandArgsParser(identityResolver: { resolve: typeof identityService.resolve } = identityService) {
    return async function parseCommandArgs(ctx: CommandContext, fallbackMode?: Mode, getAttributes?: boolean): Promise<CommandArgs> {
        if (ctx.isInteraction) {
            if (!ctx.interaction) throw new Error("Interaction command context is missing interaction data");
            const options = parseSlashCommandOptions(ctx.interaction.data, getAttributes);
            return {
                user: await identityResolver.resolve({
                    authorDiscordUserId: ctx.user.id,
                    authorDiscordUsername: ctx.user.username,
                    guildId: ctx.guildId,
                    explicitIdentity: options.explicitIdentity,
                    mentionedDiscordUserId: options.mentionedDiscordUserId,
                    explicitMode: options.explicitMode,
                    fallbackMode,
                    beatmapId: options.beatmapId,
                }),
                mods: options.mods,
                flags: options.flags,
                titleFilter: options.titleFilter,
                page: options.page,
                index: options.index,
                grade: options.grade,
                difficultySettings: options.difficultySettings,
            };
        }
        if (!ctx.message) throw new Error("Message command context is missing message data");
        const options = parsePrefixCommandOptions(ctx.args);
        return {
            user: await identityResolver.resolve({
                authorDiscordUserId: ctx.message.author.id,
                authorDiscordUsername: ctx.message.author.username,
                guildId: ctx.guildId,
                explicitIdentity: options.mentionedDiscordUserId ? undefined : options.explicitIdentity,
                mentionedDiscordUserId: options.mentionedDiscordUserId,
                fallbackMode,
                beatmapId: options.beatmapId,
            }),
            mods: options.mods,
            flags: options.flags,
            titleFilter: options.titleFilter,
            page: options.page,
            index: ctx.index,
        };
    };
}

export const parseCommandArgs = createCommandArgsParser();
