import { getEntry } from "@utils/database";
import { getSlashCommandMention } from "../state/command-registry";
import { Mode } from "@type/osu";
import { Tables } from "@type/database";
import { UserType, type User as CommandUser } from "@type/command-args";
import type { User } from "@type/database";
import { DEFAULT_PROVIDER_ID } from "../providers/provider-id";
import type { ExternalIdentity } from "@type/external-identity";

export type ResolvedExternalIdentity = ExternalIdentity;

export interface GuildIdentityResolver {
    resolve(input: { guildId: string; discordUserId: string; discordUsername: string }): Promise<ResolvedExternalIdentity | null>;
}

export const noopGuildIdentityResolver: GuildIdentityResolver = {
    resolve: async () => null,
};

export interface IdentityResolutionInput {
    authorDiscordUserId: string;
    authorDiscordUsername?: string;
    guildId?: string | null;
    explicitIdentity?: string;
    mentionedDiscordUserId?: string;
    explicitMode?: string;
    fallbackMode?: Mode;
    beatmapId: string | null;
}

function normalizeMode(value: string | null | undefined): Mode | undefined {
    return value === Mode.OSU || value === Mode.TAIKO || value === Mode.FRUITS || value === Mode.MANIA ? value : undefined;
}

export function resolveMode(
    explicitMode: string | null | undefined,
    fallbackMode: Mode | undefined,
    savedMode: string | null | undefined,
): Mode {
    return normalizeMode(explicitMode) ?? fallbackMode ?? normalizeMode(savedMode) ?? Mode.OSU;
}

export function createIdentityService({
    getUser = (discordUserId: string) => getEntry(Tables.USER, discordUserId),
    guildResolver = noopGuildIdentityResolver,
}: {
    getUser?: (discordUserId: string) => Promise<User | null>;
    guildResolver?: GuildIdentityResolver;
} = {}) {
    return {
        async resolve(input: IdentityResolutionInput): Promise<CommandUser> {
            const authorDb = await getUser(input.authorDiscordUserId);
            const mode = resolveMode(input.explicitMode, input.fallbackMode, authorDb?.mode);
            const base = { authorDb, beatmapId: input.beatmapId };

            // An explicit osu! username is intentional and must not be overridden by a mention or guild policy.
            if (input.explicitIdentity) {
                return { ...base, type: UserType.SUCCESS, identity: { externalId: input.explicitIdentity }, mode };
            }
            if (input.mentionedDiscordUserId) {
                const mentioned = await getUser(input.mentionedDiscordUserId);
                if (mentioned?.banchoId)
                    return {
                        ...base,
                        type: UserType.SUCCESS,
                        identity: { provider: DEFAULT_PROVIDER_ID, externalId: mentioned.banchoId },
                        mode,
                    };
                return {
                    ...base,
                    type: UserType.FAIL,
                    failMessage: `The user <@${input.mentionedDiscordUserId}> hasn't linked their account to the bot yet!`,
                };
            }
            if (authorDb?.banchoId)
                return {
                    ...base,
                    type: UserType.SUCCESS,
                    identity: { provider: DEFAULT_PROVIDER_ID, externalId: authorDb.banchoId },
                    mode,
                };
            if (input.guildId && input.authorDiscordUsername) {
                const resolved = await guildResolver.resolve({
                    guildId: input.guildId,
                    discordUserId: input.authorDiscordUserId,
                    discordUsername: input.authorDiscordUsername,
                });
                if (resolved) return { ...base, type: UserType.SUCCESS, identity: resolved, mode };
            }
            return {
                ...base,
                type: UserType.FAIL,
                failMessage: `Please link your account to the bot using ${getSlashCommandMention("link")}!`,
            };
        },
    };
}

export const identityService = createIdentityService();
