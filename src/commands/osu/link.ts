import { CommandData } from "@type/commands";
import { HanamiIdentityUnavailableError, isBotIdentityResolutionEnabled, resolveHanamiIdentity } from "@services/identity-resolver";
import { CommandContext } from "@utils/command-context";
import { getHanamiAccountUrl } from "@utils/hanami-account-url";

export async function run(ctx: CommandContext) {
    if (!ctx.isInteraction) return;
    await ctx.defer(true);

    if (!isBotIdentityResolutionEnabled()) {
        await ctx.editReply(
            `Create a unified Hanami account at [Hanami registration](<${getHanamiAccountUrl("register")}>) or [log in](<${getHanamiAccountUrl("login")}>) to manage an existing account.`,
        );
        return;
    }

    try {
        const resolution = await resolveHanamiIdentity(ctx.user.id);
        if (resolution.status === "active") {
            await ctx.editReply(`Your unified Hanami account is ready. Open [account management](<${getHanamiAccountUrl("account")}>) to review it.`);
            return;
        }
        if (resolution.status === "incomplete") {
            await ctx.editReply(`Your Discord account is verified. [Verify your osu! account](<${getHanamiAccountUrl("complete")}>) to finish your unified Hanami account.`);
            return;
        }
        if (resolution.status === "not_found") {
            await ctx.editReply(`You do not have a Hanami account yet. [Verify Discord and osu! to register](<${getHanamiAccountUrl("register")}>)`);
            return;
        }

        await ctx.editReply("This identity has a conflict and cannot be changed automatically. Please contact Hanami support.");
    } catch (error) {
        if (!(error instanceof HanamiIdentityUnavailableError)) throw error;
        await ctx.editReply(`Hanami account status is temporarily unavailable. You can still [open Hanami login](<${getHanamiAccountUrl("login")}>) and try again there.`);
    }
}

export const data = {
    name: "link",
    description: "Set up or manage your unified Hanami account.",
    hasPrefixVariant: false,
} satisfies CommandData;
