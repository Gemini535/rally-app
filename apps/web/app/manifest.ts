import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Rally', short_name: 'Rally', description: 'Find your next run.', start_url: '/', display: 'standalone', background_color: '#0A0A0B', theme_color: '#0A0A0B', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}
