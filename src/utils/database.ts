import { PrismaClient } from '@prisma/client';
import { logger } from "./logger";
import type { Tables, TableToArgument, TableToType } from "@type/database";

export const prisma = new PrismaClient();
const ENABLE_DB_PERF_MONITORING = process.env.NODE_ENV === "development";

function getPrismaModel(table: string): any {
    switch(table) {
        case "users": return prisma.user;
        case "guilds": return prisma.guild;
        case "maps": return prisma.map;
        case "commands": return prisma.command;
        case "osu_scores": return prisma.score;
        case "osu_scores_pp": return prisma.scorePp;
        default: throw new Error(`Unknown table ${table}`);
    }
}

function getPrismaId(table: string, id: string | number): any {
    if (table === "osu_scores" || table === "osu_scores_pp") {
        return BigInt(id);
    }
    return id.toString();
}

const bigIntFields = new Set(["joined_at", "user_id", "map_id", "score"]);

function mapToPrisma(key: string, value: any): any {
    if (value === null || value === undefined) return null;
    if (bigIntFields.has(key) && (typeof value === "number" || typeof value === "string")) {
        try {
            return BigInt(value);
        } catch {
            // If it fails, check if it's an ISO date string (like guild.joinedAt)
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return BigInt(date.getTime());
            }
            return 0n;
        }
    }
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }
    return value;
}

function mapFromPrisma(data: any): any {
    if (!data) return data;
    const res = { ...data };
    for (const key of Object.keys(res)) {
        if (typeof res[key] === "bigint") {
            res[key] = Number(res[key]);
        }
    }
    if ("prefixes" in res && typeof res.prefixes === "string") {
        try {
            res.prefixes = JSON.parse(res.prefixes);
        } catch {
            // keep as is
        }
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
        const data = await model.findUnique({ where: { id: getPrismaId(table, id) } });
        return mapFromPrisma(data) as TableToType<T> | null;
    });
}

export async function removeEntry(table: Tables, id: string | number): Promise<void> {
    const model = getPrismaModel(table);
    try {
        await model.delete({ where: { id: getPrismaId(table, id) } });
    } catch {
        // Ignore if not found
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
        data: Array<{ key: TableToArgument<T>; value: string | number | boolean | null }>;
    },
    ignore?: boolean,
): Promise<void> {
    const model = getPrismaModel(table);
    const prismaId = getPrismaId(table, id);
    
    const obj: any = {};
    for (const item of data) {
        obj[item.key as string] = mapToPrisma(item.key as string, item.value);
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
        data: Array<{ key: TableToArgument<T>; value: string | number | boolean | null }>;
        ignore?: boolean;
    }>,
): Promise<void> {
    // We execute these sequentially in a transaction to avoid race conditions
    // Prisma doesn't support bulk upsert directly in createMany for MySQL, so we use transaction array
    const transactions = entries.map(entry => {
        const model = getPrismaModel(entry.table);
        const prismaId = getPrismaId(entry.table, entry.id);
        
        const obj: any = {};
        for (const item of entry.data) {
            obj[item.key as string] = mapToPrisma(item.key as string, item.value);
        }
        
        if (entry.ignore) {
            return model.createMany({
                data: { id: prismaId, ...obj },
                skipDuplicates: true
            });
        } else {
            return model.upsert({
                where: { id: prismaId },
                create: { id: prismaId, ...obj },
                update: obj
            });
        }
    });
    
    await prisma.$transaction(transactions);
}
