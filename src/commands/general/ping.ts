import { CommandData } from "@type/commands";
import { v2 } from "osu-api-extended";
import { safeParse } from "@utils/safe-parse";

import { CommandContext } from "@utils/command-context";

export async function run(ctx: CommandContext) {
    await ctx.defer();
    const isMessage = ctx.isMessage;

    if (isMessage) {
        await ctx.reply({ content: "🏓..." });
    }

    const { ws, rest } = await ctx.client.ping();
    const osuDuration = await getOsuResponseTime();

    await ctx.editReply({
        content: `🏓 WebSocket: \`${ws.toFixed()}ms\` | Rest: \`${rest.toFixed()}ms\`\nosu! API: \`${osuDuration.toFixed()}ms\``,
    });
}

async function getOsuResponseTime() {
    const userId = 17279598;

    const osuStart = Date.now();
    await safeParse(v2.users.details({ user: userId }));
    const osuEnd = Date.now();

    return osuEnd - osuStart;
}

export const data = {
    name: "ping",
    description: "Replies with a pong followed by latency information",
    hasPrefixVariant: true,
} satisfies CommandData;
