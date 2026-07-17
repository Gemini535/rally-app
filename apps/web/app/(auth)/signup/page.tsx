'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const submit = async (form: FormData) => { setLoading(true); setError(null); const email = String(form.get('email')); const password = String(form.get('password')); const handle = String(form.get('handle')); const displayName = String(form.get('displayName')); const { data, error: authError } = await createClient().auth.signUp({ email, password }); if (authError || !data.session) { setError(authError?.message ?? 'Confirm your email, then sign in to finish setup.'); setLoading(false); return; } try { await api.post('/me', { handle, displayName }); router.push('/onboarding'); } catch (cause) { setError(cause instanceof ApiError && cause.code === 'CONFLICT' ? 'That handle is already taken.' : 'Could not create your profile.'); } finally { setLoading(false); } };
  return <main className="grid min-h-screen place-items-center p-6"><Card className="w-full max-w-md"><CardHeader><CardTitle>Create your Rally account</CardTitle></CardHeader><CardContent><form action={submit} className="space-y-3"><input className="w-full rounded border bg-transparent p-3" name="displayName" placeholder="Display name" required /><input className="w-full rounded border bg-transparent p-3" name="handle" placeholder="handle" required /><input className="w-full rounded border bg-transparent p-3" name="email" type="email" placeholder="Email" required /><input className="w-full rounded border bg-transparent p-3" name="password" type="password" minLength={6} placeholder="Password" required /><button className="w-full rounded bg-white p-3 font-medium text-black" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button></form>{error && <p className="pt-3 text-sm text-red-400">{error}</p>}<p className="pt-4 text-center text-sm"><a href="/login">Already have an account?</a></p></CardContent></Card></main>;
}
