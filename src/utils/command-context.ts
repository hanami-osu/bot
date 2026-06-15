import { Client } from "lilybird";
import { GuildInteraction, Message, ApplicationCommandData, GuildTextChannel, User, MessageReplyOptions, InteractionReplyOptions } from "@lilybird/transformers";
import type { EmbedBuilderOptions } from "@type/builders";

type ReplyOptions = string | MessageReplyOptions | InteractionReplyOptions;
interface SentMessage {
    id?: string;
    edit(options: ReplyOptions): Promise<unknown>;
}

export class CommandContext {
    public readonly isInteraction: boolean;
    public readonly isMessage: boolean;

    constructor(
        public readonly client: Client,
        public readonly interaction?: GuildInteraction<ApplicationCommandData>,
        public readonly message?: Message,
        public readonly args: Array<string> = [],
        public readonly prefix?: string,
        public readonly commandName?: string,
        public readonly channel?: GuildTextChannel,
        public readonly index?: number
    ) {
        this.isInteraction = !!interaction;
        this.isMessage = !!message;
    }

    get user(): User {
        if (this.interaction) return this.interaction.member.user;
        if (this.message) return this.message.author;
        throw new Error("Command context does not include a Discord user");
    }

    get guildId(): string | undefined {
        if (this.interaction) return this.interaction.guildId;
        return this.message?.guildId;
    }

    get channelId(): string {
        const channelId = this.interaction?.channelId ?? this.message?.channelId;
        if (!channelId) throw new Error("Command context does not include a channel id");
        return channelId;
    }

    private sentMessage?: SentMessage;

    async defer(): Promise<void> {
        if (this.interaction) {
            await this.interaction.deferReply();
        } else if (this.channelId) {
            await this.client.rest.triggerTypingIndicator(this.channelId);
        }
    }

    async reply(options: ReplyOptions): Promise<unknown> {
        if (this.interaction) {
            if (typeof options === "string") await this.interaction.reply(options);
            else await this.interaction.reply(options as InteractionReplyOptions);
            this.sentMessage = undefined;
            return this.sentMessage;
        } else if (this.message) {
            this.sentMessage = (typeof options === "string" ? await this.message.reply(options) : await this.message.reply(options as MessageReplyOptions)) as unknown as SentMessage;
            return this.sentMessage;
        }
        throw new Error("Command context cannot reply without interaction or message data");
    }

    async editReply(options: ReplyOptions): Promise<unknown> {
        if (this.interaction) {
            return typeof options === "string" ? await this.interaction.editReply(options) : await this.interaction.editReply(options as InteractionReplyOptions);
        } else {
            if (this.sentMessage) {
                return await this.sentMessage.edit(options);
            } else {
                return await this.reply(options);
            }
        }
    }

    async sendWithPagination(options: ReplyOptions, embedOptions: EmbedBuilderOptions): Promise<void> {
        const { ButtonStateCache } = await import("./cache");
        const sentMessage = await this.editReply(options);
        
        if (this.isMessage && typeof sentMessage === "object" && sentMessage !== null && "id" in sentMessage && typeof sentMessage.id === "string") {
            await ButtonStateCache.set(sentMessage.id, embedOptions);
        } else if (this.interaction) {
            setTimeout(async () => {
                try {
                    if (!this.interaction) return;
                    const message = await this.client.rest.getOriginalInteractionResponse(this.interaction.applicationId, this.interaction.token);
                    if (message && message.id) {
                        await ButtonStateCache.set(message.id, embedOptions);
                    }
                } catch (error) {
                    const { logger } = await import("./logger");
                    await logger.warn("Could not cache interaction pagination state", { error });
                }
            }, 100);
        }
    }
}
