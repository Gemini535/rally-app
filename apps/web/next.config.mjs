import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local development keeps the shared demo credentials at the workspace root.
// This file is gitignored and absent on hosted builds (e.g. Vercel), so skip it
// when missing and rely on the platform-provided environment instead.
const envPath = resolve(process.cwd(), '../../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

/** @type {import('next').NextConfig} */
// Workspace packages publish their compiled contract. Keeping this unset avoids
// resolving the TypeScript source's ESM `.js` specifiers during Next builds.
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Browser requests use the Next adapter, preserving Supabase's cookie session.
    NEXT_PUBLIC_API_URL: '/api',
  },
  experimental: {
    // Next's file tracing can't detect Prisma's native query engine, so it gets
    // dropped from the serverless bundle → PrismaClientInitializationError at
    // runtime. pnpm hoists the generated client to the workspace root, so the
    // engine lives two levels up from this app. Globbing the whole client dir
    // captures the platform-specific binary (libquery_engine-*.so.node on
    // Vercel's Linux runtime) plus schema.prisma.
    //
    // The key is a picomatch glob (contains-match) against the normalized app
    // route, which for this catch-all is `/app/api/[[...route]]`. We can't key
    // on the literal path because its `[[...]]` are glob character-classes that
    // never match; `/api/**` matches the route without brackets.
    //
    // We glob two locations because the client's real path depends on how the
    // environment resolves the pnpm store: the hoisted `.prisma/client` symlink
    // target, and pnpm's actual virtual store (`.pnpm/@prisma+client@*/...`).
    // A real Vercel runtime PrismaClientInitializationError searched exactly the
    // latter and found nothing, so both are included to be robust to hoisting.
    outputFileTracingIncludes: {
      '/api/**': [
        '../../node_modules/.prisma/client/**/*',
        '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  webpack(config) {
    // The Express package is imported as TypeScript source by the serverless adapter.
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, '.js': ['.js', '.ts', '.tsx'] };
    return config;
  },
};

export default nextConfig;
