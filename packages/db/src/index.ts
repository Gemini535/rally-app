import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

// On Vercel, @prisma/client is bundled into the Next route chunk, so Prisma
// searches for its native query engine relative to the bundle (.next/server/…)
// and process.cwd() — never node_modules/.pnpm/@prisma+client@*/…/.prisma/client
// where pnpm actually places the engine. That mismatch throws
// PrismaClientInitializationError even though the binary is in the bundle. Point
// Prisma straight at the engine by resolving it from node_modules at startup.
function locatePrismaEngine(): string | undefined {
  const anchors = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '..', '..')];
  const isEngine = (name: string) => /^libquery_engine-.*\.so\.node$/.test(name);
  for (const anchor of anchors) {
    const clientDirs = [join(anchor, 'node_modules', '.prisma', 'client')];
    try {
      const pnpm = join(anchor, 'node_modules', '.pnpm');
      for (const entry of readdirSync(pnpm)) {
        if (entry.startsWith('@prisma+client@')) clientDirs.push(join(pnpm, entry, 'node_modules', '.prisma', 'client'));
      }
    } catch {
      // .pnpm not present at this anchor — fall through to the next.
    }
    for (const dir of clientDirs) {
      try {
        const engine = readdirSync(dir).find(isEngine);
        if (engine) return join(dir, engine);
      } catch {
        // client dir absent at this anchor — keep looking.
      }
    }
  }
  return undefined;
}

// Only needed on the Linux serverless runtime; local dev finds its own engine.
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY && process.platform === 'linux') {
  const engine = locatePrismaEngine();
  if (engine) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;
}

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
