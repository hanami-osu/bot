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

interface TableTypes {
    users: User;
    guilds: Guild;
    maps: Map;
    commands: Command;
    osu_scores: Score;
    osu_scores_pp: ScorePp;
}

export type TableToArgument<T extends Tables> = T extends Tables ? keyof TableTypes[T] : never;
export type TableToType<T extends Tables> = T extends Tables ? TableTypes[T] : never;
