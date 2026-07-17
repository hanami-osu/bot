export interface DiscordLinkRequest {
    discordUserId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

export interface DiscordLinkResponse {
    url: string;
    expiresAt: string; // 2026-07-18T...
}
