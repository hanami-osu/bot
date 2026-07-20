import { banchoProvider } from "./bancho-provider";
import { DEFAULT_PROVIDER_ID, type ProviderId } from "@type/provider";
import type { ScoreProvider } from "./score-provider";

export interface ProviderRegistry {
    get(provider?: ProviderId): ScoreProvider;
}

export function createProviderRegistry(providers: ReadonlyArray<ScoreProvider>): ProviderRegistry {
    const providersById = new Map(providers.map((provider) => [provider.id, provider]));

    return {
        get(provider?: ProviderId): ScoreProvider {
            const providerId = provider ?? DEFAULT_PROVIDER_ID;
            const resolved = providersById.get(providerId);
            if (resolved) return resolved;

            if (provider) throw new Error(`No implementation is registered for the requested provider: ${provider}.`);
            throw new Error(`No implementation is registered for the default provider: ${providerId}.`);
        },
    };
}

export const providerRegistry = createProviderRegistry([banchoProvider]);
