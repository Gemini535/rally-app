import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rally — find your next run', template: '%s · Rally' },
  description: 'Rank the courts you love, see where the run is live, and find your next game in Chicago.',
  applicationName: 'Rally',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rally' },
};

export const viewport: Viewport = { themeColor: '#0A0A0B' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
