import { prisma } from "@utils/database";
import { logger } from "@utils/logger";
import type { HanamiIdentity, HanamiIdentityResolution } from "@type/identity";
import { createHanamiIdentityClientFromEnvironment, HanamiIdentityClientError, isDecimalProviderId, type HanamiIdentityClientLike } from "./hanami-identity-client";

const DEFAULT_FRESH_CACHE_TTL_SECONDS = 300;
const DEFAULT_DEGRADED_CACHE_TTL_SECONDS = 3600;
const MAX_CACHE_TTL_SECONDS = 86_400;

export interface CachedHanamiIdentityRecord {
    id: string;
    banchoId: string | null;
    hanamiUserId: string | null;
    identitySyncedAt: Date | null;
    identityVersion: number;
}

export interface IdentityStore {
    findByDiscordId(discordId: string): Promise<CachedHanamiIdentityRecord | null>;
    applyActiveIdentity(identity: HanamiIdentity, syncedAt: Date): Promise<"updated" | "conflict">;
    markInactive(discordId: string, identityVersion: number, syncedAt: Date): Promise<"updated" | "conflict">;
}

interface IdentityAuditLogger {
    warn(message: string, context?: Record<string, unknown>): Promise<void> | void;
}

export interface IdentityResolverConfig {
    freshCacheTtlMs: number;
    degradedCacheTtlMs: number;
}

export class HanamiIdentityUnavailableError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "HanamiIdentityUnavailableError";
    }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class PrismaIdentityStore implements IdentityStore {
    async findByDiscordId(discordId: string): Promise<CachedHanamiIdentityRecord | null> {
        return prisma.user.findUnique({
            where: { id: discordId },
            select: {
                id: true,
                banchoId: true,
                hanamiUserId: true,
                identitySyncedAt: true,
                identityVersion: true,
            },
        });
    }

    async applyActiveIdentity(identity: HanamiIdentity, syncedAt: Date): Promise<"updated" | "conflict"> {
        try {
            return await prisma.$transaction(async (transaction) => {
                const [discordOwner, canonicalOwner, osuOwner] = await Promise.all([
                    transaction.user.findUnique({ where: { id: identity.discordId } }),
                    transaction.user.findUnique({ where: { hanamiUserId: identity.hanamiUserId } }),
                    transaction.user.findFirst({ where: { banchoId: identity.osuId } }),
                ]);

                if (canonicalOwner && canonicalOwner.id !== identity.discordId) return "conflict";
                if (osuOwner && osuOwner.id !== identity.discordId) return "conflict";
                if (discordOwner?.hanamiUserId && discordOwner.hanamiUserId !== identity.hanamiUserId) return "conflict";
                if (discordOwner?.banchoId && discordOwner.banchoId !== identity.osuId) return "conflict";
                if ((discordOwner?.identityVersion ?? 0) > identity.identityVersion) return "conflict";

                await transaction.user.upsert({
                    where: { id: identity.discordId },
                    create: {
                        id: identity.discordId,
                        banchoId: identity.osuId,
                        hanamiUserId: identity.hanamiUserId,
                        identitySyncedAt: syncedAt,
                        identityVersion: identity.identityVersion,
                    },
                    update: {
                        banchoId: identity.osuId,
                        hanamiUserId: identity.hanamiUserId,
                        identitySyncedAt: syncedAt,
                        identityVersion: identity.identityVersion,
                    },
                });
                return "updated";
            });
        } catch (error) {
            if (isPrismaUniqueConstraintError(error)) return "conflict";
            throw error;
        }
    }

    async markInactive(discordId: string, identityVersion: number, syncedAt: Date): Promise<"updated" | "conflict"> {
        return prisma.$transaction(async (transaction) => {
            const user = await transaction.user.findUnique({ where: { id: discordId } });
            if (!user) return "updated";
            if (user.identityVersion > identityVersion) return "conflict";

            await transaction.user.update({
                where: { id: discordId },
                data: {
                    banchoId: null,
                    identitySyncedAt: syncedAt,
                    identityVersion,
                },
            });
            return "updated";
        });
    }
}

function parseCacheTtlSeconds(name: string, rawValue: string | undefined, fallback: number): number {
    if (typeof rawValue === "undefined" || rawValue.length === 0) return fallback;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > MAX_CACHE_TTL_SECONDS) {
        throw new HanamiIdentityUnavailableError(`${name} must be an integer between 1 and ${MAX_CACHE_TTL_SECONDS}`);
    }
    return value;
}

export function getIdentityResolverConfigFromEnvironment(): IdentityResolverConfig {
    const freshCacheTtlSeconds = parseCacheTtlSeconds("BOT_IDENTITY_CACHE_TTL_SECONDS", process.env.BOT_IDENTITY_CACHE_TTL_SECONDS, DEFAULT_FRESH_CACHE_TTL_SECONDS);
    const degradedCacheTtlSeconds = parseCacheTtlSeconds(
        "BOT_IDENTITY_DEGRADED_CACHE_TTL_SECONDS",
        process.env.BOT_IDENTITY_DEGRADED_CACHE_TTL_SECONDS,
        DEFAULT_DEGRADED_CACHE_TTL_SECONDS,
    );
    if (degradedCacheTtlSeconds < freshCacheTtlSeconds) {
        throw new HanamiIdentityUnavailableError("BOT_IDENTITY_DEGRADED_CACHE_TTL_SECONDS cannot be shorter than BOT_IDENTITY_CACHE_TTL_SECONDS");
    }

    return {
        freshCacheTtlMs: freshCacheTtlSeconds * 1000,
        degradedCacheTtlMs: degradedCacheTtlSeconds * 1000,
    };
}

export function isBotIdentityResolutionEnabled(): boolean {
    return process.env.BOT_IDENTITY_RESOLUTION_ENABLED === "true";
}

function getCachedIdentity(record: CachedHanamiIdentityRecord | null): HanamiIdentity | null {
    if (
        !record ||
        !record.hanamiUserId ||
        record.hanamiUserId.length > 255 ||
        record.hanamiUserId.trim() !== record.hanamiUserId ||
        !isDecimalProviderId(record.id) ||
        !isDecimalProviderId(record.banchoId) ||
        !Number.isSafeInteger(record.identityVersion) ||
        record.identityVersion < 0
    ) {
        return null;
    }

    return {
        hanamiUserId: record.hanamiUserId,
        discordId: record.id,
        osuId: record.banchoId,
        identityVersion: record.identityVersion,
    };
}

function getCacheAgeMs(record: CachedHanamiIdentityRecord | null, now: Date): number | null {
    const syncedAt = record?.identitySyncedAt;
    if (!(syncedAt instanceof Date) || Number.isNaN(syncedAt.getTime())) return null;
    const age = now.getTime() - syncedAt.getTime();
    if (age < -60_000) return null;
    return Math.max(0, age);
}

export class HanamiIdentityResolver {
    constructor(
        private readonly store: IdentityStore,
        private readonly webClient: HanamiIdentityClientLike,
        private readonly config: IdentityResolverConfig,
        private readonly now: () => Date = () => new Date(),
        private readonly auditLogger: IdentityAuditLogger = logger,
    ) {}

    async resolve(discordId: string): Promise<HanamiIdentityResolution> {
        const cachedRecord = await this.store.findByDiscordId(discordId);
        const cachedIdentity = getCachedIdentity(cachedRecord);
        const now = this.now();
        const cacheAgeMs = getCacheAgeMs(cachedRecord, now);

        if (cachedIdentity && cacheAgeMs !== null && cacheAgeMs <= this.config.freshCacheTtlMs) {
            return { status: "active", identity: cachedIdentity, source: "fresh_cache" };
        }

        let response;
        try {
            response = await this.webClient.resolve(discordId);
        } catch (error) {
            if (
                error instanceof HanamiIdentityClientError &&
                error.allowsDegradedCache &&
                cachedIdentity &&
                cacheAgeMs !== null &&
                cacheAgeMs <= this.config.degradedCacheTtlMs
            ) {
                await this.auditLogger.warn("Using bounded degraded Hanami identity cache", { eventType: "identity_degraded_cache", sourceService: "bot", outcome: "allowed" });
                return { status: "active", identity: cachedIdentity, source: "degraded_cache" };
            }
            throw new HanamiIdentityUnavailableError("Hanami identity could not be verified right now", { cause: error });
        }

        if (response.status !== "active") {
            if (response.status === "conflict") {
                await this.auditLogger.warn("Hanami identity conflict reported", { eventType: "bot_identity_conflict", sourceService: "bot", outcome: "blocked" });
                return { status: "conflict" };
            }

            const updateResult = await this.store.markInactive(discordId, response.identityVersion, now);
            if (updateResult === "conflict") {
                await this.auditLogger.warn("Hanami identity version conflict detected", { eventType: "bot_identity_conflict", sourceService: "bot", outcome: "blocked" });
                return { status: "conflict" };
            }
            return { status: response.status };
        }

        const identity: HanamiIdentity = {
            hanamiUserId: response.hanamiUserId,
            discordId: response.discordId,
            osuId: response.osuId,
            identityVersion: response.identityVersion,
        };
        const updateResult = await this.store.applyActiveIdentity(identity, now);
        if (updateResult === "conflict") {
            await this.auditLogger.warn("Local Hanami identity ownership conflict detected", { eventType: "bot_identity_conflict", sourceService: "bot", outcome: "blocked" });
            return { status: "conflict" };
        }

        return { status: "active", identity, source: "web" };
    }
}

export async function resolveHanamiIdentity(discordId: string): Promise<HanamiIdentityResolution> {
    try {
        const resolver = new HanamiIdentityResolver(new PrismaIdentityStore(), createHanamiIdentityClientFromEnvironment(), getIdentityResolverConfigFromEnvironment());
        return await resolver.resolve(discordId);
    } catch (error) {
        if (error instanceof HanamiIdentityUnavailableError) throw error;
        throw new HanamiIdentityUnavailableError("Hanami identity could not be verified right now", { cause: error });
    }
}
