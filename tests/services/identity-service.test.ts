import { describe, expect, test } from "bun:test";
import { createIdentityService, noopGuildIdentityResolver } from "../../src/services/identity-service";
import { Mode } from "../../src/types/osu";
import { UserType } from "../../src/types/command-args";

function service(
    users = new Map<string, { id: string; banchoId: string | null; mode?: Mode | null }>(),
    resolver = noopGuildIdentityResolver,
) {
    return createIdentityService({ getUser: async (id) => (users.get(id) ?? null) as never, guildResolver: resolver });
}

describe("identity service", () => {
    test("prioritizes explicit usernames and mode input", async () => {
        const result = await service(new Map([["author", { id: "author", banchoId: "linked", mode: Mode.MANIA }]])).resolve({
            authorDiscordUserId: "author",
            explicitIdentity: "peppy",
            explicitMode: Mode.TAIKO,
            fallbackMode: Mode.OSU,
            beatmapId: null,
        });
        expect(result).toMatchObject({ type: UserType.SUCCESS, banchoId: "peppy", mode: Mode.TAIKO });
    });

    test("resolves mentioned Discord users and reports unlinked mentions", async () => {
        const resolver = service(new Map([["mentioned", { id: "mentioned", banchoId: "cookiezi" }]]));
        await expect(
            resolver.resolve({ authorDiscordUserId: "author", mentionedDiscordUserId: "mentioned", beatmapId: null }),
        ).resolves.toMatchObject({ banchoId: "cookiezi" });
        await expect(
            resolver.resolve({ authorDiscordUserId: "author", mentionedDiscordUserId: "missing", beatmapId: null }),
        ).resolves.toMatchObject({
            type: UserType.FAIL,
            failMessage: "The user <@missing> hasn't linked their account to the bot yet!",
        });
    });

    test("uses linked account, then a supplied trusted-guild resolver without mutating it", async () => {
        const linked = await service(new Map([["author", { id: "author", banchoId: "linked", mode: Mode.FRUITS }]])).resolve({
            authorDiscordUserId: "author",
            fallbackMode: Mode.OSU,
            beatmapId: null,
        });
        expect(linked).toMatchObject({ banchoId: "linked", mode: Mode.OSU });
        const guildService = service(new Map(), { resolve: async () => ({ provider: "bancho", externalId: "guild-name" }) });
        const guild = await guildService.resolve({
            authorDiscordUserId: "author",
            authorDiscordUsername: "Name",
            guildId: "guild",
            beatmapId: null,
        });
        expect(guild).toMatchObject({ type: UserType.SUCCESS, banchoId: "guild-name" });
    });

    test("default trusted-guild resolution is a no-op", async () => {
        await expect(
            service().resolve({ authorDiscordUserId: "author", authorDiscordUsername: "Name", guildId: "guild", beatmapId: null }),
        ).resolves.toMatchObject({ type: UserType.FAIL });
    });
});
