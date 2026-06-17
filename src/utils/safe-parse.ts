export type SafeParseResult<T> = { success: true; data: T } | { success: false; data: null };

export async function safeParse<T>(promise: Promise<T>): Promise<SafeParseResult<T>> {
    try {
        const data = await promise;
        if (data && typeof data === "object" && "error" in data) {
            return { success: false, data: null };
        }
        return { success: true, data };
    } catch {
        return { success: false, data: null };
    }
}
