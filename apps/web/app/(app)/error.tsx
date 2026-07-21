'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-dvh place-items-center p-6 text-center"><section><p className="text-4xl">↻</p><h1 className="mt-4 text-2xl font-semibold">That court slipped away</h1><p className="mt-2 text-rally-secondary">Your connection is fine to retry — we’ll keep your place.</p><button onClick={reset} className="mt-6 min-h-11 rounded-control bg-emerald-400 px-5 font-semibold text-black">Try again</button></section></main>;
}
