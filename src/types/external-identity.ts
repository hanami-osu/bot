import type { ProviderId } from "../providers/provider-id";

/** An account identifier issued by an external score and user provider. */
export interface ExternalIdentity {
    provider?: ProviderId;
    externalId: string;
}
