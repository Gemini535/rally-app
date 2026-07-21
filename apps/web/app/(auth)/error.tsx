'use client';
import { useEffect } from 'react';
export default function AuthError({ error, reset }: { error: Error; reset: () => void }) { useEffect(() => { console.error(error); }, [error]); return <main className="grid min-h-dvh place-items-center p-6 text-center"><section><h1 className="text-2xl font-semibold">We couldn’t reach Rally</h1><p className="mt-2 text-rally-secondary">Your sign-in details are safe. Give it another try.</p><button onClick={reset} className="mt-6 min-h-11 rounded-control bg-emerald-400 px-5 font-semibold text-black">Try again</button></section></main>; }
