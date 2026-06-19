import type { CommandFileData } from "@type/commands";

export const commandsCache = new Map<string, CommandFileData>();
export const commandAliasesCache = new Map<string, string>();
export const slashCommandIdsCache = new Map<string, string>();

export function registerCommand(command: CommandFileData): void {
    commandsCache.set(command.data.name, command);

    const aliases = command.data.message?.aliases;
    if (!Array.isArray(aliases)) return;

    for (const alias of aliases) {
        commandAliasesCache.set(alias, command.data.name);
    }
}

export function resolveCommand(commandName: string): CommandFileData | undefined {
    const alias = commandAliasesCache.get(commandName);
    return alias ? commandsCache.get(alias) : commandsCache.get(commandName);
}

export function registerSlashCommandId(commandName: string, commandId: string): void {
    slashCommandIdsCache.set(commandName, commandId);
}

export function getSlashCommandMention(commandName: string): string {
    const cachedValue = slashCommandIdsCache.get(commandName);
    if (!cachedValue) return `/${commandName}`;
    if (cachedValue.startsWith("</")) return cachedValue;
    return `</${commandName}:${cachedValue}>`;
}
