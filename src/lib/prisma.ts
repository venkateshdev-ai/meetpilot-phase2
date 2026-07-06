// UNUSED in this build. Kept only as a reference for the "swap back to
// @prisma/client" path described in README.md and src/lib/db/supabase.ts.
//
// This sandbox's network allowlist blocks downloading Prisma's query-engine
// binary (binaries.prisma.sh -> 403 Forbidden), so @prisma/client cannot run
// a single query here, even after `prisma generate`. Every real (non-mock)
// data call in this app goes through src/lib/db/store.ts + supabase.ts
// instead. In an unrestricted environment (Vercel, your own server), you can
// restore this file and swap store.ts back to prisma.* calls — the schema in
// prisma/schema.prisma already matches the SQL migration applied to the real
// database, so no data-model changes are needed to do that.
//
// import { PrismaClient } from "@prisma/client";
//
// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
//
// export const prisma =
//   globalForPrisma.prisma ??
//   new PrismaClient({
//     log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
//   });
//
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export {};
