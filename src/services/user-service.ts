import type { Mode, UserExtended } from "@type/osu";
import { providerRegistry, type ProviderRegistry } from "../providers/provider-registry";
import type { ExternalIdentity } from "@type/external-identity";

export function createUserService(registry: ProviderRegistry = providerRegistry) {
    return {
        getUser(identity: ExternalIdentity, mode: Mode): Promise<UserExtended | null> {
            const provider = registry.get(identity.provider);
            return provider.getUser(identity.externalId, mode);
        },
    };
}

export const userService = createUserService();
