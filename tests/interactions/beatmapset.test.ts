import { beforeEach, expect, mock, test } from "bun:test";

const state: any = {
    type: "mapsetBuilder", initiatorId: "owner", page: 0, mods: ["HD"],
    beatmapset: {
        id: 1, artist: "Artist", title: "Song", creator: "Mapper", user_id: 1,
        status: "ranked", favourite_count: 1, play_count: 2,
        beatmaps: Array.from({ length: 6 }, (_, i) => ({
            id: i + 10, version: `Diff ${i + 1}`, mode: "osu", difficulty_rating: i + 1,
            total_length: 90, bpm: 180, max_combo: 500, ar: 9, accuracy: 8, cs: 4, drain: 6,
            count_circles: 100, count_sliders: 80, count_spinners: 1,
        })),
    },
};
const get = mock(async (): Promise<any> => state);
const set = mock(async () => true);
mock.module("@state/button-state-cache", () => ({ ButtonStateCache: { get, set } }));
mock.module("@builders", () => ({ compareBuilder: mock(), leaderboardBuilder: mock() }));
mock.module("@services/play-service", () => ({ buildPlayPaginationMessageOptions: mock() }));
const beatmapBuilder = mock(async (_options: any) => [{ title: "Selected difficulty" }]);
mock.module("../../src/embed-builders/beatmap", () => ({ beatmapBuilder }));
const { handlePaginationInteraction } = await import("../../src/interactions/pagination-handler");

function interaction(id = "beatmapset-difficulty", user = "owner", values = ["10"]) {
    return {
        isMessageComponentInteraction: () => true, isModalSubmitInteraction: () => false,
        data: { isButton: () => id !== "beatmapset-difficulty", isSelectMenu: () => id === "beatmapset-difficulty", type: id === "beatmapset-difficulty" ? 3 : 2, id, values }, message: { id: "message", channelId: "channel" },
        inGuild: () => true, inDM: () => false, member: { user: { id: user } },
        reply: mock(async (_options: any) => undefined), updateComponents: mock(async (_options: any) => undefined),
        editReply: mock(async (_options: any) => undefined),
    };
}

beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue(structuredClone(state));
    set.mockClear();
    beatmapBuilder.mockClear();
});

test("difficulty selection renders the chosen map with the original mods", async () => {
    const input = interaction();
    expect(await handlePaginationInteraction(input as never)).toBe(true);
    expect(beatmapBuilder).toHaveBeenCalledWith(expect.objectContaining({ beatmapId: 10, mods: ["HD"], initiatorId: "owner" }));
    expect(input.editReply.mock.calls[0]?.[0].embeds[0].title).toBe("Selected difficulty");
    const menu = input.editReply.mock.calls[0]?.[0].components.at(-1).components[0];
    expect(input.updateComponents.mock.calls[0]?.[0].components.at(-1).components[0].disabled).toBe(true);
    expect(set).toHaveBeenCalledWith("message", expect.objectContaining({ selectedBeatmapId: 10, mods: ["HD"] }));
    expect(menu.type).toBe(3);
    expect(menu.options.find((option: any) => option.value === "10").default).toBe(true);
});

test("next page exposes remaining difficulties", async () => {
    const input = interaction("increment-page");
    await handlePaginationInteraction(input as never);
    expect(set).toHaveBeenCalledWith("message", expect.objectContaining({ page: 1 }));
    expect(input.editReply.mock.calls[0]?.[0].embeds[0].fields[0].name).toContain("Diff 6");
    expect(input.editReply.mock.calls[0]?.[0].components.at(-1).components[0].options).toHaveLength(6);
});

test.each([["999"], ["abc"], [], ["10", "11"]])("rejects invalid selection %j", async (...values) => {
    const input = interaction(undefined, "owner", values);
    await handlePaginationInteraction(input as never);
    expect(input.reply.mock.calls[0]?.[0].ephemeral).toBe(true);
    expect(beatmapBuilder).not.toHaveBeenCalled();
});

test("other users cannot select a difficulty", async () => {
    const input = interaction(undefined, "other");
    await handlePaginationInteraction(input as never);
    expect(input.reply.mock.calls[0]?.[0]).toMatchObject({ ephemeral: true });
    expect(beatmapBuilder).not.toHaveBeenCalled();
    expect(input.updateComponents).not.toHaveBeenCalled();
});

test("expired difficulty controls ask for a fresh command", async () => {
    get.mockResolvedValueOnce(null);
    const input = interaction();
    await handlePaginationInteraction(input as never);
    expect(input.reply.mock.calls[0]?.[0].embeds[0].title).toBe("Controls expired");
    expect(beatmapBuilder).not.toHaveBeenCalled();
});

test("a failed difficulty request restores usable controls", async () => {
    beatmapBuilder.mockRejectedValueOnce(new Error("download failed"));
    const input = interaction();
    await handlePaginationInteraction(input as never);
    const response = input.editReply.mock.calls[0]?.[0];
    expect(response.embeds[0].description).toContain("try again");
    expect(response.components.flatMap((row: any) => row.components).some((button: any) =>
        button.custom_id === "beatmapset-difficulty" && !button.disabled,
    )).toBe(true);
});

test("page jump renders the requested set page", async () => {
    const input = {
        ...interaction(),
        isMessageComponentInteraction: () => false,
        isModalSubmitInteraction: () => true,
        data: {
            id: "pagination-jump:page:channel:message",
            components: [{ type: 1, components: [{ type: 4, custom_id: "pagination-jump-value", value: "2" }] }],
        },
    };
    await handlePaginationInteraction(input as never);
    expect(set).toHaveBeenCalledWith("message", expect.objectContaining({ page: 1 }));
    expect(input.updateComponents.mock.calls[0]?.[0].embeds[0].fields[0].name).toContain("Diff 6");
});

test("does not intercept unrelated select menus", async () => {
    const input = interaction();
    input.data.id = "unrelated-select";
    expect(await handlePaginationInteraction(input as never)).toBe(false);
    expect(get).not.toHaveBeenCalled();
});

test("the dropdown can select a difficulty outside the overview page", async () => {
    const input = interaction(undefined, "owner", ["15"]);
    await handlePaginationInteraction(input as never);
    expect(beatmapBuilder).toHaveBeenCalledWith(expect.objectContaining({ beatmapId: 15 }));
    expect(input.editReply.mock.calls[0]?.[0].components.at(-1).components[0].options.find((option: any) => option.value === "15").default).toBe(true);
});
