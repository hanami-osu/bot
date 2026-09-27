import type { NoChokePaginationOptions } from "@type/builders";
import type { NoChokeScore } from "../embed-builders/nochoke";
import { noChokeEmbed } from "../embed-builders/nochoke";
import { getFormattedProfile, getFormattedScore } from "@utils/formatter";
import { saveScoreDatas } from "@utils/osu";
import { createPaginationActionRow, ITEMS_PER_PAGE } from "@utils/pagination";
import type { Message, Embed } from "lilybird";

export interface NoChokePaginationMessageOptions {
    embeds: Array<Embed.Structure>;
    components: Array<Message.Component.Structure>;
}

export async function buildNoChokePaginationMessageOptions(options: NoChokePaginationOptions): Promise<NoChokePaginationMessageOptions> {
    const page = options.page ?? 0;
    const pageStart = page * ITEMS_PER_PAGE;
    const pageGains = options.gains.slice(pageStart, pageStart + ITEMS_PER_PAGE);

    await saveScoreDatas(options.scores, options.mode);

    const profile = getFormattedProfile(options.user, options.mode);
    const gains: Array<NoChokeScore> = await Promise.all(
        pageGains.map(async gain => ({
            play: await getFormattedScore({ scores: options.scores, index: gain.index, mode: options.mode, authorDb: options.authorDb }),
            currentPp: gain.currentPp,
            fcPp: gain.fcPp,
            playMaxCombo: options.scores[gain.index]?.max_combo ?? 0,
        })),
    );

    return {
        embeds: [
            noChokeEmbed({
                profile,
                mode: options.mode,
                currentTotalPp: options.currentTotalPp,
                noChokeTotalPp: options.noChokeTotalPp,
                gains,
                authorDb: options.authorDb,
            }),
        ],
        components: createPaginationActionRow(options),
    };
}
