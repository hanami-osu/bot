import { afterEach, describe, expect, test } from "bun:test";
import { getHanamiAccountUrl } from "../../src/utils/hanami-account-url";

const originalWebUrl = process.env.HANAMI_WEB_URL;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
    process.env.HANAMI_WEB_URL = originalWebUrl;
    process.env.NODE_ENV = originalNodeEnv;
});

describe("Hanami account URLs", () => {
    test("uses only fixed allowlisted destinations", () => {
        process.env.HANAMI_WEB_URL = "https://hanami.gg";
        expect(getHanamiAccountUrl("login")).toBe("https://hanami.gg/login");
        expect(getHanamiAccountUrl("register")).toBe("https://hanami.gg/register");
        expect(getHanamiAccountUrl("account")).toBe("https://hanami.gg/account");
        expect(getHanamiAccountUrl("complete")).toBe("https://hanami.gg/account/complete");
    });

    test("rejects configured paths, queries, and production HTTP origins", () => {
        process.env.HANAMI_WEB_URL = "https://hanami.gg/redirect?next=https://evil.example";
        expect(() => getHanamiAccountUrl("login")).toThrow("must be an origin");

        process.env.NODE_ENV = "production";
        process.env.HANAMI_WEB_URL = "http://hanami.gg";
        expect(() => getHanamiAccountUrl("login")).toThrow("must use HTTPS");
    });
});
