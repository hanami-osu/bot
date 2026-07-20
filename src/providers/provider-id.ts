export const PROVIDER_IDS = ["bancho", "gatari"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const DEFAULT_PROVIDER_ID: ProviderId = "bancho";
