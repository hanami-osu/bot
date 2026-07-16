import type { Mode } from "./osu";

export enum Tables {
    USER = "users",
    GUILD = "guilds",
    MAP = "maps",
    COMMAND = "commands",
    SCORE = "osu_scores",
    PP = "osu_scores_pp",
}

export enum EmbedScoreType {
    Hanami = "hanami",
    Bathbot = "bathbot",
    Owo = "owobot",
}

export interface User {
    id: string;
    banchoId: string | null;
    hanamiUserId: string | null;
    identitySyncedAt: Date | null;
    identityVersion: number;
    score_embeds: number | null;
    embed_type: EmbedScoreType | null;
    mode: string | null;
    score_data: number | null;
}

export interface Guild {
    id: string;
    name: string;
    owner_id: string;
    joined_at: string | null;
    prefixes: Array<string> | null;
}

export interface Map {
    id: string;
    data: string;
}

export interface Command {
    id: string;
    count: number | null;
}

export interface Score {
    id: string;
    user_id: string;
    map_id: string;
    gamemode: Mode;
    mods: string;
    score: string;
    accuracy: number;
    max_combo: number;
    grade: string;
    count_50: number;
    count_100: number;
    count_300: number;
    count_miss: number;
    count_geki: number;
    count_katu: number;
    map_state: "ranked" | "graveyard" | "wip" | "pending" | "approved" | "qualified" | "loved";
    ended_at: string;
}

export interface ScorePp {
    id: string;
    pp: number;
    pp_fc: number;
    pp_perfect: number;
}

export enum ScoreEmbed {
    Maximized = 1,
    Minimized = 0,
}

export enum ScoreData {
    Stable = 0,
    Lazer = 1,
}

export type TableToArgument<T extends Tables> = T extends "users"
    ? keyof User
    : T extends "guilds"
      ? keyof Guild
      : T extends "maps"
        ? keyof Map
        : T extends "commands"
          ? keyof Command
          : T extends "osu_scores"
            ? keyof Score
            : T extends "osu_scores_pp"
              ? keyof ScorePp
              : never;

export type TableToType<T extends Tables> = T extends "users"
    ? User
    : T extends "guilds"
      ? Guild
      : T extends "maps"
        ? Map
        : T extends "commands"
          ? Command
          : T extends "osu_scores"
            ? Score
            : T extends "osu_scores_pp"
              ? ScorePp
              : never;
