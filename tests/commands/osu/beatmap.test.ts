import { beforeEach, expect, mock, test } from "bun:test";

let parsedArgs: any;
const parseCommandArgs = mock(() => Promise.resolve(parsedArgs));
mock.module("@utils/args", () => ({ parseCommandArgs, CommandValidationError: class extends Error {} }));
const beatmapBuilder = mock(() => Promise.resolve([{ title: "Difficulty details" }]));
mock.module("../../../src/embed-builders/beatmap", () => ({ beatmapBuilder }));
const getBeatmapIdFromContext = mock(() => Promise.resolve(42));
mock.module("@utils/osu", () => ({ getBeatmapIdFromContext, formatDuration: mock(() => "1:30") }));
const details = mock((): Promise<any> => Promise.resolve({
    id: 123456, artist: "Artist", title: "Song", creator: "Mapper", user_id: 1,
    status: "ranked", favourite_count: 3, play_count: 10, beatmaps: [],
}));
mock.module("osu-api-extended", () => ({ v2: { beatmaps: { details } } }));
const { run } = await import("../../../src/commands/osu/beatmap");

function context() {
    return {
        defer: mock(async () => undefined), user: { id: "owner" }, beatmapLookupContext: {},
        editReply: mock(async (_options: any) => undefined),
        sendWithPagination: mock(async (_options: any, _state: any) => undefined),
    };
}

beforeEach(() => {
    parsedArgs = { user: { beatmapId: null }, beatmapsetId: "123456", mods: { name: "HDHR" } };
    beatmapBuilder.mockClear();
    getBeatmapIdFromContext.mockClear();
    details.mockClear();
});

test("set links render an overview without falling back to channel history", async () => {
    const ctx = context();
    await run(ctx as never);
    expect(parseCommandArgs).toHaveBeenCalledWith(ctx, "osu", undefined, true);
    expect(details).toHaveBeenCalledWith({ type: "set", id: 123456 });
    expect(ctx.sendWithPagination.mock.calls[0]?.[0].embeds[0].title).toContain("Song");
    expect(ctx.sendWithPagination.mock.calls[0]?.[1]).toMatchObject({ initiatorId: "owner", mods: ["HD", "HR"], page: 0 });
    expect(getBeatmapIdFromContext).not.toHaveBeenCalled();
    expect(beatmapBuilder).not.toHaveBeenCalled();
});

test("a difficulty link keeps the selected map and mods", async () => {
    parsedArgs.beatmapsetId = undefined;
    parsedArgs.user.beatmapId = "72727";
    const ctx = context();
    await run(ctx as never);
    expect(beatmapBuilder).toHaveBeenCalledWith(expect.objectContaining({ beatmapId: 72727, mods: ["HD", "HR"] }));
    expect(ctx.editReply).toHaveBeenCalledWith({ embeds: [{ title: "Difficulty details" }] });
    expect(details).not.toHaveBeenCalled();
});

test("missing set returns a useful error without history fallback", async () => {
    details.mockRejectedValueOnce(new Error("not found"));
    const ctx = context();
    await run(ctx as never);
    expect(ctx.editReply.mock.calls[0]?.[0].embeds[0].description).toContain("beatmapset");
    expect(ctx.sendWithPagination).not.toHaveBeenCalled();
    expect(getBeatmapIdFromContext).not.toHaveBeenCalled();
});

test("omitting a link still resolves a map from context", async () => {
    parsedArgs.beatmapsetId = undefined;
    await run(context() as never);
    expect(beatmapBuilder).toHaveBeenCalledWith(expect.objectContaining({ beatmapId: 42 }));
});
