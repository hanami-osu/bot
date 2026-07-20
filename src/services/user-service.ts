import { banchoProvider } from "../providers/bancho-provider";
import type { ScoreProvider } from "../providers/score-provider";
import type { Mode, UserExtended } from "@type/osu";

export function createUserService(provider: ScoreProvider = banchoProvider) {
    return {
        getUser(identity: string | number, mode: Mode): Promise<UserExtended | null> {
            return provider.getUser(identity, mode);
        },
    };
}

export const userService = createUserService();
