import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local development keeps the shared demo credentials at the workspace root.
for (const line of readFileSync(resolve(process.cwd(), '../../.env'), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
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
