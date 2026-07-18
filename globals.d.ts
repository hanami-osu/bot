declare module "bun" {
    interface Env {
        DISCORD_BOT_TOKEN: string;
        OWNER_ID: string;
        OSU_CLIENT_ID: number;
        OSU_CLIENT_SECRET: string;
        OSU_ACCESS_TOKEN: string;
        OSU_DAILY_API: string;
        HANAMI_WEB_URL: string;
        BOT_LINK_SECRET: string;
        REDIS_URL: string;
        ERROR_CHANNEL_ID: string;
        DEV_GUILD_ID: string;
        DEV: string;
    }
}
