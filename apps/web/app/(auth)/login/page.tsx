'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const signIn = async (email: string, password: string) => { setLoading(true); setError(null); const { error: authError } = await createClient().auth.signInWithPassword({ email, password }); setLoading(false); if (authError) setError(authError.message); else router.push('/'); };
  const submit = async (form: FormData) => signIn(String(form.get('email')), String(form.get('password')));
  return <main className="grid min-h-screen place-items-center p-6"><Card className="w-full max-w-md"><CardHeader><CardTitle>Welcome back</CardTitle><p className="text-sm text-slate-400">Find your next game.</p></CardHeader><CardContent><form action={submit} className="space-y-3"><input className="w-full rounded border bg-transparent p-3" name="email" type="email" placeholder="Email" required /><input className="w-full rounded border bg-transparent p-3" name="password" type="password" placeholder="Password" required /><button className="w-full rounded bg-white p-3 font-medium text-black" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form><div className="pt-4 text-center text-sm text-slate-400">or try the demo</div><div className="grid gap-2 pt-3"><button className="rounded border p-3 text-left" onClick={() => signIn(process.env.NEXT_PUBLIC_DEMO_EMAIL_1 ?? '', process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '')}>Try as Marcus (basketball)</button><button className="rounded border p-3 text-left" onClick={() => signIn(process.env.NEXT_PUBLIC_DEMO_EMAIL_2 ?? '', process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '')}>Try as Priya (pickleball)</button></div>{error && <p className="pt-3 text-sm text-red-400">{error}</p>}<p className="pt-4 text-center text-sm"><a href="/signup">Create an account</a></p></CardContent></Card></main>;
}
