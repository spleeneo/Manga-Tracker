import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.PRISMA_QUERY_LOG === "1" ? ["query"] : [],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
