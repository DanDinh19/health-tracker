import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient is attached to the global object in development to prevent
 * creating too many connections when hot-reloading. In production we use
 * a single instance.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
