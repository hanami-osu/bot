import { Client } from "lilybird";
import {
    Message,
    ApplicationCommandData,
    GuildTextChannel,
    User,
    MessageReplyOptions,
    InteractionReplyOptions,
    Interaction,
} from "@lilybird/transformers";
import type { EmbedBuilderOptions } from "@type/builders";

type ReplyOptions = string | MessageReplyOptions | InteractionReplyOptions;

export const CommandIntegrationType = {
    GuildInstall: 0,
    UserInstall: 1,
} as const;

export const CommandInteractionContext = {
    Guild: 0,
    BotDM: 1,
    PrivateChannel: 2,
} as const;

export type CommandIntegrationType = (typeof CommandIntegrationType)[keyof typeof CommandIntegrationType];
export type CommandInteractionContext = (typeof CommandInteractionContext)[keyof typeof CommandInteractionContext];

interface SentMessage {
    id?: string;
    edit(options: ReplyOptions): Promise<unknown>;
}

export class CommandContext {
    public readonly isInteraction: boolean;
    public readonly isMessage: boolean;
    private hasInteractionResponse = false;

    constructor(
        public readonly client: Client,
        public readonly interaction?: Interaction<ApplicationCommandData>,
        public readonly message?: Message,
        public readonly args: Array<string> = [],
        public readonly prefix?: string,
        public readonly commandName?: string,
        public readonly channel?: GuildTextChannel,
        public readonly index?: number,
    ) {
        this.isInteraction = typeof interaction !== "undefined";
        this.isMessage = typeof message !== "undefined";
    }

    get user(): User {
        if (this.interaction && this.interaction.inGuild()) return this.interaction.member.user;
        if (this.interaction && this.interaction.inDM()) return this.interaction.user;
        if (this.message) return this.message.author;
        throw new Error("Command context does not include a Discord user");
    }

    get guildId(): string | undefined | null {
        if (this.interaction && this.interaction.inGuild()) return this.interaction.guildId;
        if (this.interaction && this.interaction.inDM()) return null;
        return this.message?.guildId;
    }

    get isGuildContext(): boolean {
        return this.interaction?.inGuild() ?? typeof this.message?.guildId === "string";
    }

    get isDMContext(): boolean {
        return this.interaction?.inDM() ?? false;
    }

    get isGuildInstall(): boolean {
        if (!this.interaction) return true;
        return typeof this.interaction.authorizingIntegrationOwners?.[CommandIntegrationType.GuildInstall] !== "undefined";
    }

    get isUserInstall(): boolean {
        if (!this.interaction) return false;
        return typeof this.interaction.authorizingIntegrationOwners?.[CommandIntegrationType.UserInstall] !== "undefined";
    }

    get authorizingUserId(): string | undefined {
        const userId = this.interaction?.authorizingIntegrationOwners?.[CommandIntegrationType.UserInstall];
        return typeof userId === "string" && userId !== "0" ? userId : undefined;
    }

    get optionalChannelId(): string | undefined {
        if (this.interaction?.inGuild()) return this.interaction.channelId;
        return this.message?.channelId;
    }

    get channelId(): string {
        const channelId = this.optionalChannelId;
        if (!channelId) throw new Error("Command context does not include a channel id");
        return channelId;
    }

    get canReadChannelHistory(): boolean {
        if (this.isMessage) return true;
        return this.isGuildContext && this.isGuildInstall;
    }

    get beatmapLookupContext(): { client: Client; message?: Message; channelId?: string } {
        return {
            client: this.client,
            message: this.message,
            channelId: this.canReadChannelHistory ? this.optionalChannelId : undefined,
        };
    }

    private sentMessage?: SentMessage;

    async defer(ephemeral?: boolean): Promise<void> {
        if (this.interaction) {
            await this.interaction.deferReply(ephemeral);
            this.hasInteractionResponse = true;
        } else if (this.channelId) {
            await this.client.rest.triggerTypingIndicator(this.channelId);
        }
    }

    async reply(options: ReplyOptions): Promise<unknown> {
        if (this.interaction) {
            if (this.hasInteractionResponse) {
                return await this.editReply(options);
            }

            if (typeof options === "string") await this.interaction.reply(options);
            else await this.interaction.reply(options as InteractionReplyOptions);
            this.sentMessage = undefined;
            this.hasInteractionResponse = true;
            return this.sentMessage;
        } else if (this.message) {
            this.sentMessage = (typeof options === "string"
                ? await this.message.reply(options)
                : await this.message.reply(options as MessageReplyOptions)) as unknown as SentMessage;
            return this.sentMessage;
        }
        throw new Error("Command context cannot reply without interaction or message data");
    }

    async editReply(options: ReplyOptions): Promise<unknown> {
        if (this.interaction) {
            const message =
                typeof options === "string"
                    ? await this.interaction.editReply(options)
                    : await this.interaction.editReply(options as InteractionReplyOptions);
            this.hasInteractionResponse = true;
            return message;
        } else {
            if (this.sentMessage) {
                return await this.sentMessage.edit(options);
            } else {
                return await this.reply(options);
            }
        }
    }

    async ensureGuild(reason = "This command can only be used in a server."): Promise<boolean> {
        if (this.isGuildContext) return true;
        await this.respondUnavailable(reason);
        return false;
    }

    async respondUnavailable(content: string): Promise<void> {
        if (this.interaction && this.hasInteractionResponse) {
            await this.editReply(content);
            return;
        }

        if (this.interaction) {
            await this.reply({ content, ephemeral: true });
            return;
        }

        await this.reply(content);
    }

    async sendWithPagination(options: ReplyOptions, embedOptions: EmbedBuilderOptions): Promise<void> {
        const { ButtonStateCache } = await import("../state/button-state-cache");
        const sentMessage = await this.editReply(options);

        if (
            typeof sentMessage === "object" &&
            sentMessage !== null &&
            "id" in sentMessage &&
            typeof sentMessage.id === "string"
        ) {
            if (this.interaction) {
                try {
                    await ButtonStateCache.set(sentMessage.id, embedOptions);
                } catch (error) {
                    const { logger } = await import("./logger");
                    await logger.warn("Could not cache interaction pagination state", { error });
                }
            } else {
                try {
                    await ButtonStateCache.set(sentMessage.id, embedOptions);
                } catch (error) {
                    const { logger } = await import("./logger");
                    await logger.warn("Could not cache message pagination state", { error });
                }
            }
            return;
        }

        if (this.interaction) {
            try {
                const message = await this.client.rest.getOriginalInteractionResponse(
                    this.interaction.applicationId,
                    this.interaction.token,
                );
                if (message && message.id) {
                    await ButtonStateCache.set(message.id, embedOptions);
                }
            } catch (error) {
                const { logger } = await import("./logger");
                await logger.warn("Could not cache interaction pagination state", { error });
            }
        }
    }
}
