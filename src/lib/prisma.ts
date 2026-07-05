import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern so hot-reload in dev doesn't exhaust DB connections,
// and so serverless/edge deployments reuse a pooled connection in production.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
