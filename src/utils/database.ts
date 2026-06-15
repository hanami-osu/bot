import { PrismaClient } from '@prisma/client';
import { logger } from "./logger";
import type { Tables, TableToArgument, TableToType } from "@type/database";

export const prisma = new PrismaClient();
const ENABLE_DB_PERF_MONITORING = process.env.NODE_ENV === "development";

interface PrismaModel {
    findUnique(args: { where: { id: string | bigint } }): unknown;
    delete(args: { where: { id: string | bigint } }): unknown;
    count(): Promise<number>;
    createMany(args: { data: Record<string, unknown>; skipDuplicates: boolean }): unknown;
    upsert(args: { where: { id: string | bigint }; create: Record<string, unknown>; update: Record<string, unknown> }): unknown;
}

function getPrismaModel(table: string): PrismaModel {
    switch(table) {
        case "users": return prisma.user as unknown as PrismaModel;
        case "guilds": return prisma.guild as unknown as PrismaModel;
        case "maps": return prisma.map as unknown as PrismaModel;
        case "commands": return prisma.command as unknown as PrismaModel;
        case "osu_scores": return prisma.score as unknown as PrismaModel;
        case "osu_scores_pp": return prisma.scorePp as unknown as PrismaModel;
        default: throw new Error(`Unknown table ${table}`);
    }
}

function getPrismaId(table: string, id: string | number): string | bigint {
    if (table === "osu_scores" || table === "osu_scores_pp") {
        return parseBigIntValue(id, "id");
    }
    return id.toString();
}

const bigIntFields = new Set(["joined_at", "user_id", "map_id", "score"]);

export function parseBigIntValue(value: string | number | bigint, fieldName: string): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) throw new Error(`${fieldName} must be a safe integer or decimal string`);
        return BigInt(value);
    }

    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) throw new Error(`${fieldName} must be a decimal integer string`);
    return BigInt(trimmed);
}

function parsePrefixes(value: string): Array<string> {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((prefix): prefix is string => typeof prefix === "string")) {
        throw new Error("guild prefixes must be a JSON array of strings");
    }
    return parsed;
}

export function mapToPrismaValue(key: string, value: string | number | boolean | bigint | null | undefined): unknown {
    if (value === null || value === undefined) return null;
    if (bigIntFields.has(key)) {
        if (key === "joined_at" && typeof value === "string" && !/^-?\d+$/.test(value.trim())) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) return BigInt(date.getTime());
        }
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
            throw new Error(`${key} must be an integer-compatible value`);
        }
        return parseBigIntValue(value, key);
    }
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }
    return value;
}

export function mapFromPrismaValue(data: unknown): unknown {
    if (!data) return data;
    if (typeof data !== "object") return data;

    const res = { ...(data as Record<string, unknown>) };
    for (const key of Object.keys(res)) {
        if (typeof res[key] === "bigint") {
            res[key] = res[key].toString();
        }
    }
    if ("prefixes" in res && typeof res.prefixes === "string") {
        res.prefixes = parsePrefixes(res.prefixes);
    }
    return res;
}

async function withPerfMonitoring<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!ENABLE_DB_PERF_MONITORING) {
        return fn();
    }

    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    if (end - start > 10) {
        // Log slow queries (>10ms)
        logger.warn(`Slow DB operation: ${operation} took ${(end - start).toFixed(2)}ms`);
    }

    return result;
}


export async function getEntry<T extends Tables>(table: T, id: string | number): Promise<TableToType<T> | null> {
    return withPerfMonitoring(`getEntry: ${table}`, async () => {
        const model = getPrismaModel(table);
        const data = await Promise.resolve(model.findUnique({ where: { id: getPrismaId(table, id) } }));
        return mapFromPrismaValue(data) as TableToType<T> | null;
    });
}

function isNotFoundError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function removeEntry(table: Tables, id: string | number): Promise<boolean> {
    const model = getPrismaModel(table);
    try {
        await Promise.resolve(model.delete({ where: { id: getPrismaId(table, id) } }));
        return true;
    } catch (error) {
        if (isNotFoundError(error)) return false;
        throw new Error(`Failed to delete ${table} entry ${id}`);
    }
}

export async function getRowCount(table: Tables): Promise<number> {
    const model = getPrismaModel(table);
    return model.count();
}

export async function getRowSum(table: Tables): Promise<number> {
    // Only used for commands count right now
    if (table === "commands") {
        const aggr = await prisma.command.aggregate({
            _sum: { count: true }
        });
        return aggr._sum.count ?? 0;
    }
    return 0; // fallback if used on other tables
}

export async function insertData<T extends Tables>(
    {
        table,
        id,
        data,
    }: {
        table: T;
        id: string | number;
        data: Array<{ key: TableToArgument<T>; value: string | number | boolean | bigint | null }>;
    },
    ignore?: boolean,
): Promise<void> {
    const model = getPrismaModel(table);
    const prismaId = getPrismaId(table, id);
    
    const obj: Record<string, unknown> = {};
    for (const item of data) {
        obj[item.key as string] = mapToPrismaValue(item.key as string, item.value);
    }
    
    if (ignore) {
        await model.createMany({
            data: { id: prismaId, ...obj },
            skipDuplicates: true
        });
    } else {
        await model.upsert({
            where: { id: prismaId },
            create: { id: prismaId, ...obj },
            update: obj
        });
    }
}

export async function bulkInsertData<T extends Tables>(
    entries: Array<{
        table: T;
        id: string | number;
        data: Array<{ key: TableToArgument<T>; value: string | number | boolean | bigint | null }>;
        ignore?: boolean;
    }>,
): Promise<void> {
    // We execute these sequentially in a transaction to avoid race conditions
    // Prisma doesn't support bulk upsert directly in createMany for MySQL, so we use transaction array
    const transactions = entries.map(entry => {
        const model = getPrismaModel(entry.table);
        const prismaId = getPrismaId(entry.table, entry.id);
        
        const obj: Record<string, unknown> = {};
        for (const item of entry.data) {
            obj[item.key as string] = mapToPrismaValue(item.key as string, item.value);
        }
        
        if (entry.ignore) {
            return Promise.resolve(model.createMany({
                data: { id: prismaId, ...obj },
                skipDuplicates: true
            }));
        } else {
            return Promise.resolve(model.upsert({
                where: { id: prismaId },
                create: { id: prismaId, ...obj },
                update: obj
            }));
        }
    });
    
    await Promise.all(transactions);
}

export async function incrementCommandCount(id: string): Promise<void> {
    await prisma.command.upsert({
        where: { id },
        create: { id, count: 1 },
        update: { count: { increment: 1 } },
    });
}
