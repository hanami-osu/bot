import { Handler } from "@lilybird/handlers/advanced";
import { defaultTransformers, type DefaultTransformers } from "@lilybird/transformers";

export const handler = new Handler<DefaultTransformers>({
    transformers: defaultTransformers,
});

export const $listener = handler.storeListener.bind(handler);
