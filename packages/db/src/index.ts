import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaDirect?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// A second client pinned to DIRECT_URL (session connection, port 5432 — no pgbouncer).
// Interactive $transaction callbacks (the multi-statement ranking writes in submitComparison/
// finalizeSession, and batch jobs like the seed) deadlock or hang on the pooled pgbouncer
// connection (transaction mode, connection_limit=1): the interactive transaction holds the single
// pooled connection while its follow-up queries wait for one that never frees. Route those write
// paths here. Normal request-path reads should keep using the pooled `prisma` above.
// Falls back to the pooled client when DIRECT_URL is unset so nothing breaks without it.
export const prismaDirect =
  globalForPrisma.prismaDirect ??
  (process.env.DIRECT_URL
    ? new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
    : prisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDirect = prismaDirect;
}

export * from '@prisma/client';
export * from './geo.js';
