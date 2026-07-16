export interface HanamiIdentity {
    hanamiUserId: string;
    discordId: string;
    osuId: string;
    identityVersion: number;
}

export type BotIdentityResponse =
    | {
          status: "active";
          hanamiUserId: string;
          discordId: string;
          osuId: string;
          identityVersion: number;
          updatedAt: string;
      }
    | {
          status: "incomplete" | "not_found" | "conflict";
          identityVersion: number;
      };

export type IdentityResolutionSource = "fresh_cache" | "web" | "degraded_cache";

export type HanamiIdentityResolution =
    | {
          status: "active";
          identity: HanamiIdentity;
          source: IdentityResolutionSource;
      }
    | {
          status: "incomplete" | "not_found" | "conflict";
      };
