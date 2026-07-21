'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRallyToast } from '@/app/providers';
import { api, apiErrorMessage } from '@/lib/api-client';

const sports = ['basketball', 'pickleball', 'tennis', 'soccer'];
const gameTypes = ['PICKUP', 'CASUAL', 'COMPETITIVE'];

export default function OnboardingPage() {
  const [step, setStep] = useState(1); const [picked, setPicked] = useState<string[]>([]);
  const [skill, setSkill] = useState('INTERMEDIATE'); const [games, setGames] = useState<string[]>(['PICKUP']);
  const router = useRouter(); const toast = useRallyToast();
  const finish = async () => {
    try {
      await api.patch('/me', { homeCity: 'Chicago', homeLat: 41.8781, homeLng: -87.6298, sports: picked.map((sportSlug, index) => ({ sportSlug, skillLevel: skill, preferredGameTypes: games, isPrimary: index === 0 })) });
      router.push('/');
    } catch (error) { toast(apiErrorMessage(error)); }
  };
  return <main className="mx-auto max-w-xl p-5"><p className="text-sm text-rally-secondary">STEP {step} OF 4</p><div className="mt-3 h-1.5 rounded-full bg-rally-border"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${step * 25}%` }} /></div>{step === 1 ? <><h1 className="mt-6 text-3xl font-semibold">What do you play?</h1><p className="mt-2 text-rally-secondary">Your first pick becomes your primary sport.</p><div className="mt-7 flex flex-wrap gap-2">{sports.map((sport) => <button key={sport} onClick={() => setPicked(picked.includes(sport) ? picked.filter((item) => item !== sport) : [...picked, sport])} className={`min-h-11 rounded-control border px-4 capitalize ${picked.includes(sport) ? 'border-emerald-400 text-emerald-400' : 'border-rally-border'}`}>{sport}</button>)}</div><button disabled={!picked.length} onClick={() => setStep(2)} className="mt-8 min-h-12 w-full rounded-control bg-emerald-400 font-semibold text-black disabled:opacity-40">Continue</button></> : null}{step === 2 ? <><h1 className="mt-6 text-3xl font-semibold">How do you play?</h1><p className="mt-2 text-rally-secondary">Set a default for your selected sports.</p><div className="mt-6 flex gap-2">{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((value) => <button key={value} onClick={() => setSkill(value)} className={`rounded-control border px-3 py-2 text-sm ${skill === value ? 'border-emerald-400 text-emerald-400' : 'border-rally-border'}`}>{value.toLowerCase()}</button>)}</div><div className="mt-5 flex flex-wrap gap-2">{gameTypes.map((value) => <button key={value} onClick={() => setGames(games.includes(value) ? games.filter((item) => item !== value) : [...games, value])} className={`rounded-control border px-3 py-2 text-sm ${games.includes(value) ? 'border-emerald-400' : 'border-rally-border'}`}>{value.toLowerCase()}</button>)}</div><button onClick={() => setStep(3)} className="mt-8 min-h-12 w-full rounded-control bg-emerald-400 font-semibold text-black">Continue</button></> : null}{step === 3 ? <><h1 className="mt-6 text-3xl font-semibold">Where do you play?</h1><p className="mt-2 text-rally-secondary">We’ll start you in Chicago and use this for nearby court recommendations.</p><button onClick={() => setStep(4)} className="mt-8 min-h-12 w-full rounded-control bg-emerald-400 font-semibold text-black">Use Chicago area</button></> : null}{step === 4 ? <><h1 className="mt-6 text-3xl font-semibold">Rank a few places</h1><p className="mt-2 text-rally-secondary">You can log your first court from the map now. Three rankings make recommendations much better.</p><button onClick={finish} className="mt-8 min-h-12 w-full rounded-control bg-emerald-400 font-semibold text-black">Finish setup</button></> : null}</main>;
}
