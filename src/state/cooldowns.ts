export const cooldownsCache = new Map<string, number>();

setInterval(
    () => {
        const now = Date.now();
        for (const [key, expiresAt] of cooldownsCache.entries()) {
            if (expiresAt <= now) {
                cooldownsCache.delete(key);
            }
        }
    },
    5 * 60 * 1000,
);

export function getCooldownExpiry(commandName: string, userId: string): number | undefined {
    return cooldownsCache.get(`${commandName}:${userId}`);
}

export function setCommandCooldown(commandName: string, userId: string, cooldownMs: number): void {
    cooldownsCache.set(`${commandName}:${userId}`, Date.now() + cooldownMs);
}
