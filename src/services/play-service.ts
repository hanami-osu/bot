import { EmbedBuilderType, type ModStructure, type PlayPaginationOptions, type PlaysBuilderOptions } from "@type/builders";
import { type SuccessUser } from "@type/command-args";
import { type Mode, PlayType, type Score, type ScoresInfo } from "@type/osu";
import { simpleErrorEmbed, userNotFoundEmbed } from "../embed-builders/common";
import { playBuilder } from "../embed-builders/plays";
import { getFormattedProfile, getFormattedScore } from "@utils/formatter";
import { saveScoreDatas } from "@utils/osu";
import { createPaginationActionRow, ITEMS_PER_PAGE } from "@utils/pagination";
import { filterPlays } from "@utils/play-filters";
import { safeParse } from "@utils/safe-parse";
import { getUserScores, USER_SCORE_FETCH_LIMIT } from "@utils/score-api";
import { v2 } from "osu-api-extended";
import type { Message, Embed } from "lilybird";
import type { MessageReplyOptions } from "@lilybird/transformers";

interface FetchedPlayReplyOptions {
    user: SuccessUser;
    authorId: string;
    playType: PlayType;
    emptyMessage: (username: string) => string;
    index?: number;
    page?: number;
    isPage?: boolean;
    includeFails?: boolean;
    isMultiple?: boolean;
    sortByDate?: boolean;
    mods?: ModStructure;
    titleFilter?: string;
}

interface FetchedPlayReply {
    reply: MessageReplyOptions;
    embedOptions?: PlayPaginationOptions;
}

export interface PlayPaginationMessageOptions {
    embeds: Array<Embed.Structure>;
    components: Array<Message.Component.Structure>;
}

export async function getFetchedPlayReply({
    user,
    authorId,
    playType,
    emptyMessage,
    index,
    page,
    isPage,
    includeFails,
    isMultiple,
    sortByDate,
    mods,
    titleFilter,
}: FetchedPlayReplyOptions): Promise<FetchedPlayReply> {
    const osuUserRequest = await safeParse(v2.users.details({ user: user.banchoId, mode: user.mode }));
    if (!osuUserRequest.success) {
        return {
            reply: {
                embeds: [userNotFoundEmbed(user.banchoId)],
            },
        };
    }

    const osuUser = osuUserRequest.data;
    const plays = await getUserScores(
        osuUser.id,
        playType,
        {
            query: {
                mode: user.mode,
                limit: USER_SCORE_FETCH_LIMIT,
                include_fails: includeFails,
            },
        },
        user.authorDb,
    );

    if (plays.length === 0) {
        return {
            reply: {
                embeds: [simpleErrorEmbed(emptyMessage(osuUser.username))],
            },
        };
    }

    const embedOptions: PlayPaginationOptions = {
        type: EmbedBuilderType.PLAYS,
        initiatorId: authorId,
        user: osuUser,
        mode: user.mode,
        authorDb: user.authorDb,
        plays,
        index,
        page,
        isPage,
        isMultiple,
        sortByDate,
        mods,
        titleFilter,
    };

    return {
        reply: await buildPlayPaginationMessageOptions(embedOptions),
        embedOptions,
    };
}

export async function buildPlayPaginationMessageOptions(options: PlayPaginationOptions): Promise<PlayPaginationMessageOptions> {
    const builderOptions = await getPlayBuilderOptions(options);
    return {
        embeds: await playBuilder(builderOptions),
        components: createPaginationActionRow(options),
    };
}

async function getPlayBuilderOptions({
    plays: rawPlays,
    user,
    mode,
    index,
    mods,
    isMultiple,
    page,
    authorDb,
    sortByDate,
    titleFilter,
}: PlayPaginationOptions): Promise<PlaysBuilderOptions> {
    await saveScoreDatas(rawPlays, mode);

    if (typeof page === "undefined" && typeof index === "undefined") {
        if (isMultiple) page = 0;
        else index = 0;
    }

    let plays = filterPlays(rawPlays, { mods, titleFilter }) as Array<Score>;

    if (sortByDate) {
        plays = [...plays].sort((a, b) => {
            const dateA = ("created_at" in a ? a.created_at : a.ended_at) ?? "";
            const dateB = ("created_at" in b ? b.created_at : b.ended_at) ?? "";
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }

    const profile = getFormattedProfile(user, mode);
    const totalPlays = plays.length;
    const formattedPlays = await getFormattedPlaysForView({ plays, mode, index, page, totalPlays });

    return {
        profile,
        plays: formattedPlays,
        mode,
        index,
        isMultiple,
        page,
        authorDb,
        totalPlays,
    };
}

async function getFormattedPlaysForView({
    plays,
    mode,
    index,
    page,
    totalPlays,
}: {
    plays: Array<Score>;
    mode: Mode;
    index?: number;
    page?: number;
    totalPlays: number;
}): Promise<Array<ScoresInfo>> {
    if (totalPlays === 0) return [];

    if (typeof index !== "undefined" && (index < 0 || index >= totalPlays)) return [];
    if (typeof page !== "undefined" && (page < 0 || page * ITEMS_PER_PAGE >= totalPlays)) return [];

    if (typeof page !== "undefined") {
        const pageStart = page * ITEMS_PER_PAGE;
        const pageEnd = pageStart + ITEMS_PER_PAGE;
        const formattedPlays: Array<Promise<ScoresInfo>> = [];

        for (let i = pageStart; pageEnd > i && i < plays.length; i++) {
            formattedPlays.push(getFormattedScore({ scores: plays, index: i, mode }));
        }

        return Promise.all(formattedPlays);
    }

    if (typeof index !== "undefined") {
        return [await getFormattedScore({ scores: plays, index, mode })];
    }

    return [];
}
