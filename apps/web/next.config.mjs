/** @type {import('next').NextConfig} */
// Workspace packages publish their compiled contract. Keeping this unset avoids
// resolving the TypeScript source's ESM `.js` specifiers during Next builds.
const nextConfig = {
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
