import { Suspense } from 'react';
// The home UI lives in `app-home.tsx`, NOT `(app)/page.tsx`: this file must be
// the only one that owns the "/" route. If the UI were a `page.tsx` inside the
// (app) route group, Next would register two files resolving to "/", which
// breaks Vercel's build-time manifest tracing (ENOENT on
// page_client-reference-manifest.js). Keep the home page as a plain import here.
import AppHome from './(app)/app-home';

export default function HomePage() {
  return <Suspense fallback={<main className="min-h-dvh animate-pulse bg-rally-base" />}><AppHome /></Suspense>;
}
