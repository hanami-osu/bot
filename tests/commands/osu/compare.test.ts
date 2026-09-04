import { describe, expect, mock, test } from "bun:test";
import { EMBED_COLORS } from "../../../src/embed-builders/common";
import { Mode } from "../../../src/types/osu";

class CommandValidationError extends Error {}

mock.module("@utils/args", () => ({
    CommandValidationError,
    parseCommandArgs: mock(() =>
        Promise.resolve({
            user: {
                type: "success",
                banchoId: "peppy",
                mode: Mode.OSU,
                authorDb: null,
                beatmapId: "72727",
            },
            mods: { include: true, exclude: null, forceInclude: null, name: "HD" },
        }),
    ),
}));

mock.module("osu-api-extended", () => ({
    v2: {
        users: {
            details: mock(() => Promise.resolve({ id: 2, username: "peppy" })),
        },
        beatmaps: {
            details: mock(() =>
                Promise.resolve({
                    id: 72727,
                    status: "ranked",
                    mode: Mode.OSU,
                    version: "Expert",
                    beatmapset: { id: 1234, artist: "Artist", title: "Song", title_unicode: "Song", creator: "Mapper" },
                }),
            ),
        },
    },
}));

mock.module("@utils/score-api", () => ({
    getBeatmapUserScores: mock(() =>
        Promise.resolve([
            {
                id: 1,
                mods: ["HR"],
                beatmapset: { title: "Song", title_unicode: "Song" },
            },
        ]),
    ),
}));

mock.module("@utils/formatter", () => ({
    getFormattedProfile: mock(() => ({ username: "peppy" })),
    getFormattedScore: mock(() => Promise.resolve({})),
}));

mock.module("@utils/osu", () => ({
    downloadBeatmap: mock(() => Promise.resolve({ contents: "" })),
    getBeatmapIdFromContext: mock(() => Promise.resolve(null)),
    saveScoreDatas: mock(() => Promise.resolve()),
}));

const { run } = await import("../../../src/commands/osu/compare");

describe("compare command", () => {
    test("omits pagination controls when filters leave no matching plays", async () => {
        const sendWithPagination = mock(() => Promise.resolve());
        const ctx = {
            defer: mock(() => Promise.resolve()),
            isMessage: true,
            isInteraction: false,
            commandName: "compare",
            user: { id: "123" },
            beatmapLookupContext: {},
            respondError: mock(() => Promise.resolve()),
            editReply: mock(() => Promise.resolve()),
            sendWithPagination,
        } as never;

        await run(ctx);

        expect(sendWithPagination).toHaveBeenCalledWith(
            {
                embeds: [
                    expect.objectContaining({
                        title: "Nothing to show",
                        color: EMBED_COLORS.brand,
                    }),
                ],
                components: [],
            },
            expect.anything(),
        );
    });
});
