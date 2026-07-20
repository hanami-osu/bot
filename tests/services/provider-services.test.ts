import { describe, expect, mock, test } from "bun:test";
import { createProviderRegistry } from "../../src/providers/provider-registry";
import type { ScoreProvider } from "../../src/providers/score-provider";
import { createScoreQueryService } from "../../src/services/score-query-service";
import { createUserService } from "../../src/services/user-service";
import { Mode, PlayType } from "../../src/types/osu";

function provider(id: ScoreProvider["id"]): ScoreProvider {
    return {
        id,
        getUser: mock(() => Promise.resolve({ id: 1, username: id, statistics: {}, country: {}, cover: {} } as never)),
        getUserScores: mock(() => Promise.resolve([])),
        getBeatmapUserScores: mock(() => Promise.resolve([])),
    };
}

describe("provider registry and services", () => {
    test("resolves omitted and explicit Bancho providers", () => {
        const bancho = provider("bancho");
        const registry = createProviderRegistry([bancho]);

        expect(registry.get()).toBe(bancho);
        expect(registry.get("bancho")).toBe(bancho);
    });

    test("rejects explicitly requested providers without an implementation", () => {
        const registry = createProviderRegistry([provider("bancho")]);

        expect(() => registry.get("gatari")).toThrow("No implementation is registered for the requested provider: gatari.");
    });

    test("routes user lookups through the identity provider", async () => {
        const bancho = provider("bancho");
        const gatari = provider("gatari");
        const service = createUserService(createProviderRegistry([bancho, gatari]));

        await service.getUser({ provider: "gatari", externalId: "gatari-user" }, Mode.MANIA);

        expect(gatari.getUser).toHaveBeenCalledWith("gatari-user", Mode.MANIA);
        expect(bancho.getUser).not.toHaveBeenCalled();
    });

    test("defaults identities without a provider to Bancho", async () => {
        const bancho = provider("bancho");
        const service = createUserService(createProviderRegistry([bancho]));

        await service.getUser({ externalId: "default-user" }, Mode.OSU);

        expect(bancho.getUser).toHaveBeenCalledWith("default-user", Mode.OSU);
    });

    test("routes score lookups through the identity provider", async () => {
        const bancho = provider("bancho");
        const gatari = provider("gatari");
        const service = createScoreQueryService(createProviderRegistry([bancho, gatari]));

        await service.getUserScores(
            { provider: "gatari", externalId: "gatari-user" },
            42,
            PlayType.BEST,
            { query: { mode: Mode.OSU, limit: 1 } },
            null,
        );

        expect(gatari.getUserScores).toHaveBeenCalledWith(42, PlayType.BEST, { query: { mode: Mode.OSU, limit: 1 } }, null);
        expect(bancho.getUserScores).not.toHaveBeenCalled();
    });
});
