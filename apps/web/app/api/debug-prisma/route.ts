import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// TEMPORARY diagnostic route. Bypasses the Hono catch-all (a static segment
// beats the optional catch-all `[[...route]]`) so we can inspect exactly which
// Prisma client files exist at runtime in production, from both possible
// working-directory anchors. Delete once the Prisma bundling issue is resolved.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DirResult =
  | { path: string; exists: true; entries: { name: string; type: 'dir' | 'file' | 'symlink' }[] }
  | { path: string; exists: false; error: { code?: string; message: string } };

// Never throws — an ENOENT (or any fs error) is captured and returned as data.
function listDir(absPath: string): DirResult {
  try {
    const entries = readdirSync(absPath, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? ('dir' as const) : entry.isSymbolicLink() ? ('symlink' as const) : ('file' as const),
    }));
    return { path: absPath, exists: true, entries };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { path: absPath, exists: false, error: { code: err.code, message: err.message } };
  }
}

// For a given anchor dir, probe the hoisted client and the pnpm virtual store.
function probeAnchor(anchor: string) {
  // (1) hoisted client relative to the anchor
  const hoistedPrismaClient = listDir(join(anchor, 'node_modules', '.prisma', 'client'));

  // (2) list .pnpm and filter to @prisma+client@* directories
  const pnpmPath = join(anchor, 'node_modules', '.pnpm');
  const pnpmDir = listDir(pnpmPath);
  const prismaClientStores =
    pnpmDir.exists
      ? pnpmDir.entries
          .filter((entry) => entry.name.startsWith('@prisma+client@'))
          // (3) for each match, list its nested node_modules/.prisma/client
          .map((match) => ({
            name: match.name,
            client: listDir(join(pnpmPath, match.name, 'node_modules', '.prisma', 'client')),
          }))
      : [];

  return { anchor, hoistedPrismaClient, pnpm: { dir: pnpmDir, prismaClientStores } };
}

export function GET() {
  const cwd = process.cwd();
  const dirname = __dirname;
  const payload = {
    note: 'temporary diagnostic — inspect Prisma client files present at runtime',
    runtime: { cwd, dirname, node: process.version, platform: process.platform, arch: process.arch },
    // Report both anchors since we are not certain which matches the real
    // runtime location of node_modules in the serverless bundle.
    anchors: { fromCwd: probeAnchor(cwd), fromDirname: probeAnchor(dirname) },
  };
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
