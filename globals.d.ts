declare module "bun" {
    interface Env {
        DISCORD_BOT_TOKEN: string;
        OWNER_ID: string;
        OSU_CLIENT_ID: number;
        OSU_CLIENT_SECRET: string;
        OSU_ACCESS_TOKEN: string;
        OSU_DAILY_API: string;
        OSU_TOKEN_PATH: string;
        REDIS_URL: string;
        DATABASE_URL: string;
        ERROR_CHANNEL_ID: string;
        DEV_GUILD_ID: string;
        DEV: string;
        HANAMI_WEB_URL: string;
        HANAMI_WEB_IDENTITY_URL: string;
        HANAMI_BOT_SERVICE_SECRET: string;
        HANAMI_BOT_SERVICE_SECRET_PREVIOUS: string;
        BOT_IDENTITY_RESOLUTION_ENABLED: string;
        BOT_IDENTITY_REQUEST_TIMEOUT_MS: string;
        BOT_IDENTITY_CACHE_TTL_SECONDS: string;
        BOT_IDENTITY_DEGRADED_CACHE_TTL_SECONDS: string;
    }
}
