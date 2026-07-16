import { describe, expect, mock, test } from "bun:test";
import {
    HanamiIdentityResolver,
    HanamiIdentityUnavailableError,
    type CachedHanamiIdentityRecord,
    type IdentityStore,
} from "../../src/services/identity-resolver";
import { HanamiIdentityClientError, type HanamiIdentityClientLike } from "../../src/services/hanami-identity-client";
import type { BotIdentityResponse, HanamiIdentity } from "../../src/types/identity";

const now = new Date("2026-07-17T12:00:00.000Z");
const discordId = "123456789012345678";
const activeIdentity: HanamiIdentity = {
    hanamiUserId: "hanami-user-1",
    discordId,
    osuId: "12345",
    identityVersion: 2,
};
const activeResponse: BotIdentityResponse = {
    status: "active",
    ...activeIdentity,
    updatedAt: "2026-07-17T11:59:00.000Z",
};

class FakeIdentityStore implements IdentityStore {
    public activeUpdateResult: "updated" | "conflict" = "updated";
    public inactiveUpdateResult: "updated" | "conflict" = "updated";
    public activeUpdates: Array<HanamiIdentity> = [];
    public inactiveUpdates: Array<{ discordId: string; identityVersion: number }> = [];

    constructor(public record: CachedHanamiIdentityRecord | null) {}

    findByDiscordId(): Promise<CachedHanamiIdentityRecord | null> {
        return Promise.resolve(this.record);
    }

    applyActiveIdentity(identity: HanamiIdentity, syncedAt: Date): Promise<"updated" | "conflict"> {
        if (this.activeUpdateResult === "conflict") return Promise.resolve("conflict");
        this.activeUpdates.push(identity);
        this.record = {
            id: identity.discordId,
            banchoId: identity.osuId,
            hanamiUserId: identity.hanamiUserId,
            identitySyncedAt: syncedAt,
            identityVersion: identity.identityVersion,
        };
        return Promise.resolve("updated");
    }

    markInactive(targetDiscordId: string, identityVersion: number, syncedAt: Date): Promise<"updated" | "conflict"> {
        if (this.inactiveUpdateResult === "conflict") return Promise.resolve("conflict");
        this.inactiveUpdates.push({ discordId: targetDiscordId, identityVersion });
        if (this.record) {
            this.record = { ...this.record, banchoId: null, identityVersion, identitySyncedAt: syncedAt };
        }
        return Promise.resolve("updated");
    }
}

function cachedRecord(ageMs: number, identityVersion = 1): CachedHanamiIdentityRecord {
    return {
        id: discordId,
        banchoId: activeIdentity.osuId,
        hanamiUserId: activeIdentity.hanamiUserId,
        identitySyncedAt: new Date(now.getTime() - ageMs),
        identityVersion,
    };
}

function createResolver(store: FakeIdentityStore, resolve: () => Promise<BotIdentityResponse>) {
    const client: HanamiIdentityClientLike = { resolve: mock(resolve) };
    const auditLogger = { warn: mock(() => Promise.resolve()) };
    return {
        resolver: new HanamiIdentityResolver(store, client, { freshCacheTtlMs: 300_000, degradedCacheTtlMs: 3_600_000 }, () => now, auditLogger),
        client,
        auditLogger,
    };
}

describe("Hanami identity resolver", () => {
    test("returns a fresh active cache without calling Web", async () => {
        const store = new FakeIdentityStore(cachedRecord(60_000));
        const { resolver, client } = createResolver(store, () => Promise.resolve(activeResponse));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status: "active", identity: { ...activeIdentity, identityVersion: 1 }, source: "fresh_cache" });
        expect(client.resolve).not.toHaveBeenCalled();
    });

    test("refreshes a stale cache and updates the identity version", async () => {
        const store = new FakeIdentityStore(cachedRecord(600_000));
        const { resolver, client } = createResolver(store, () => Promise.resolve(activeResponse));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status: "active", identity: activeIdentity, source: "web" });
        expect(client.resolve).toHaveBeenCalledWith(discordId);
        expect(store.record?.identityVersion).toBe(2);
        expect(store.record?.identitySyncedAt).toEqual(now);
    });

    test.each(["incomplete", "not_found"] as const)("clears the active osu cache for a %s response", async (status) => {
        const store = new FakeIdentityStore(cachedRecord(600_000));
        const { resolver } = createResolver(store, () => Promise.resolve({ status, identityVersion: 3 }));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status });
        expect(store.record?.banchoId).toBeNull();
        expect(store.inactiveUpdates).toEqual([{ discordId, identityVersion: 3 }]);
    });

    test("blocks a Web-reported conflict without changing cached ownership", async () => {
        const original = cachedRecord(600_000);
        const store = new FakeIdentityStore(original);
        const { resolver, auditLogger } = createResolver(store, () => Promise.resolve({ status: "conflict", identityVersion: 3 }));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status: "conflict" });
        expect(store.record).toBe(original);
        expect(store.activeUpdates).toHaveLength(0);
        expect(store.inactiveUpdates).toHaveLength(0);
        expect(auditLogger.warn).toHaveBeenCalledTimes(1);
    });

    test("uses a bounded degraded cache only for a temporary Web failure", async () => {
        const store = new FakeIdentityStore(cachedRecord(600_000));
        const { resolver } = createResolver(store, () => Promise.reject(new HanamiIdentityClientError("offline", "unavailable", true)));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status: "active", identity: { ...activeIdentity, identityVersion: 1 }, source: "degraded_cache" });
    });

    test("fails usefully when Web is unavailable and no valid cache exists", async () => {
        const store = new FakeIdentityStore(null);
        const { resolver } = createResolver(store, () => Promise.reject(new HanamiIdentityClientError("offline", "unavailable", true)));

        await expect(resolver.resolve(discordId)).rejects.toBeInstanceOf(HanamiIdentityUnavailableError);
    });

    test("rejects a cache older than the bounded degraded window", async () => {
        const store = new FakeIdentityStore(cachedRecord(3_600_001));
        const { resolver } = createResolver(store, () => Promise.reject(new HanamiIdentityClientError("offline", "unavailable", true)));

        await expect(resolver.resolve(discordId)).rejects.toBeInstanceOf(HanamiIdentityUnavailableError);
    });

    test("does not overwrite a conflicting canonical identity", async () => {
        const original = cachedRecord(600_000);
        const store = new FakeIdentityStore(original);
        store.activeUpdateResult = "conflict";
        const { resolver, auditLogger } = createResolver(store, () => Promise.resolve(activeResponse));

        await expect(resolver.resolve(discordId)).resolves.toEqual({ status: "conflict" });
        expect(store.record).toBe(original);
        expect(store.activeUpdates).toHaveLength(0);
        expect(auditLogger.warn).toHaveBeenCalledTimes(1);
    });

    test("does not use degraded cache for invalid credentials", async () => {
        const store = new FakeIdentityStore(cachedRecord(600_000));
        const { resolver } = createResolver(store, () => Promise.reject(new HanamiIdentityClientError("unauthorized", "unauthorized", false)));

        await expect(resolver.resolve(discordId)).rejects.toBeInstanceOf(HanamiIdentityUnavailableError);
    });
});
