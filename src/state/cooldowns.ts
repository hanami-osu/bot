export const cooldownsCache = new Map<string, number>();

function getCooldownKey(commandName: string, userId: string): string {
    return `${commandName}:${userId}`;
}

export function getCooldownExpiry(commandName: string, userId: string): number | undefined {
    const key = getCooldownKey(commandName, userId);
    const expiresAt = cooldownsCache.get(key);

    if (typeof expiresAt === "undefined" || expiresAt > Date.now()) return expiresAt;

    cooldownsCache.delete(key);
    return undefined;
}

export function setCommandCooldown(commandName: string, userId: string, cooldownMs: number): void {
    cooldownsCache.set(getCooldownKey(commandName, userId), Date.now() + cooldownMs);
}
