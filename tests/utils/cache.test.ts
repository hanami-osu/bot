import { describe, expect, test } from "bun:test";
import { decodeButtonState, encodeButtonState } from "../../src/utils/cache";
import { EmbedBuilderType, type EmbedBuilderOptions } from "../../src/types/builders";

describe("cache serialization", () => {
    test("encodes compact versioned button state", () => {
        const state = {
            type: EmbedBuilderType.PLAYS,
            initiatorId: "user-1",
            plays: [],
            user: { id: 1, username: "peppy" },
            mode: "osu",
            authorDb: null,
            index: 0,
            isPage: false,
        } as unknown as EmbedBuilderOptions;

        const encoded = encodeButtonState(state);
        expect(JSON.parse(encoded)).toMatchObject({ version: 1, state: { type: EmbedBuilderType.PLAYS, initiatorId: "user-1" } });
        expect(decodeButtonState(encoded)).toEqual(state);
    });

    test("rejects malformed or unsupported button state", () => {
        expect(decodeButtonState("not-json")).toBeNull();
        expect(decodeButtonState(JSON.stringify({ version: 999, state: {} }))).toBeNull();
        expect(decodeButtonState(JSON.stringify({ version: 1, state: { type: "playsBuilder" } }))).toBeNull();
    });
});
