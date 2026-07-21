import { Suspense } from 'react';
import AppHome from './(app)/page';

export default function HomePage() {
  return <Suspense fallback={<main className="min-h-dvh animate-pulse bg-rally-base" />}><AppHome /></Suspense>;
}
