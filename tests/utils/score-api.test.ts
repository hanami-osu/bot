import { describe, expect, mock, test } from "bun:test";
import { Mode, PlayType } from "../../src/types/osu";

const listScoresMock = mock(({ offset }: { offset?: number }) => {
    const start = offset ?? 0;
    return Promise.resolve(Array.from({ length: 100 }, (_value, index) => ({ id: start + index + 1 })));
});

mock.module("osu-api-extended", () => ({
    enums: {
        ModsEnum: { HD: 8, HR: 16, DT: 64, NC: 512 },
    },
    v2: {
        scores: {
            list: listScoresMock,
        },
    },
}));

const { getUserScores } = await import("../../src/utils/score-api");

describe("score API utilities", () => {
    test("fetches user scores in offset pages when more than 100 are requested", async () => {
        const scores = await getUserScores(1, PlayType.BEST, { query: { mode: Mode.OSU, limit: 200 } }, null);

        expect(scores).toHaveLength(200);
        expect(scores[0]?.position).toBe(1);
        expect(scores[199]?.position).toBe(200);
        expect(listScoresMock).toHaveBeenCalledTimes(2);
        expect(listScoresMock.mock.calls[0]?.[0]).toMatchObject({ type: "user_best", user_id: 1, mode: "osu", limit: 100 });
        expect(listScoresMock.mock.calls[0]?.[0].offset).toBeUndefined();
        expect(listScoresMock.mock.calls[1]?.[0]).toMatchObject({ type: "user_best", user_id: 1, mode: "osu", limit: 100, offset: 100 });
    });
});
