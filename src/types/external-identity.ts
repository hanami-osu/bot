import type { ProviderId } from "./provider";

/** An account identifier issued by an external score and user provider. */
export interface ExternalIdentity {
    provider?: ProviderId;
    externalId: string;
}
