const HANAMI_ACCOUNT_PATHS = {
    login: "/login",
    register: "/register",
    account: "/account",
    complete: "/account/complete",
} as const;

export type HanamiAccountDestination = keyof typeof HANAMI_ACCOUNT_PATHS;

function getHanamiWebOrigin(): URL {
    const configuredOrigin = process.env.HANAMI_WEB_URL ?? "https://hanami.gg";
    let origin: URL;
    try {
        origin = new URL(configuredOrigin);
    } catch (error) {
        throw new Error("HANAMI_WEB_URL must be an absolute URL", { cause: error });
    }

    if (origin.username || origin.password || origin.search || origin.hash || (origin.pathname !== "/" && origin.pathname !== "")) {
        throw new Error("HANAMI_WEB_URL must be an origin without credentials, a path, query, or fragment");
    }
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
        throw new Error("HANAMI_WEB_URL must use HTTPS in production");
    }
    if (origin.protocol !== "https:" && origin.protocol !== "http:") {
        throw new Error("HANAMI_WEB_URL must use HTTP or HTTPS");
    }

    return origin;
}

export function getHanamiAccountUrl(destination: HanamiAccountDestination): string {
    return new URL(HANAMI_ACCOUNT_PATHS[destination], getHanamiWebOrigin()).toString();
}
