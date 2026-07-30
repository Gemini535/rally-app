'use client';

import { useEffect, useReducer, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Sentiment, SportSlug } from '@rally/shared';
import { api, apiErrorMessage } from '@/lib/api-client';
import { useRallyToast } from '@/app/providers';
import { ScoreBadge } from '@/components/venue/score-badge';

// Step transitions are driven by the ranking API (nextPair vs result), not a fixed comparison count,
// so DETAILS always shows once the session resolves — that's where the note/tags get captured + PATCHed.
type Step = 'SENTIMENT' | 'COMPARING' | 'DETAILS' | 'REVEAL';
type Flow = { step: Step; sentiment: Sentiment | null; comparison: number };
type Action = { type: 'sentiment'; sentiment: Sentiment } | { type: 'advance' } | { type: 'goto'; step: Step };
const initial: Flow = { step: 'SENTIMENT', sentiment: null, comparison: 0 };
function reducer(state: Flow, action: Action): Flow {
  if (action.type === 'sentiment') return { ...state, sentiment: action.sentiment, step: 'COMPARING', comparison: 0 };
  if (action.type === 'advance') return { ...state, comparison: state.comparison + 1 };
  return { ...state, step: action.step };
}
type RankResult = { rallyScore: number; rankPosition: number; totalRanked: number; beat: { name: string }[] };

export default function LogVenue({ params }: { params: { venueId: string } }) {
  const router = useRouter(); const toast = useRallyToast();
  const venueQuery = useQuery({ queryKey: ['venue', params.venueId], queryFn: () => api.get<{ venue: { id: string; name: string; sports: { slug: SportSlug }[] } }>(`/venues/${params.venueId}`) });
  const venue = venueQuery.data?.venue;
  const [flow, dispatch] = useReducer(reducer, initial); const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string>(); const [entryId, setEntryId] = useState<string>(); const [maxSteps, setMaxSteps] = useState(0);
  const [nextPair, setNextPair] = useState<{ opponentEntryId: string; opponent: { name: string } } | null>(null); const [result, setResult] = useState<RankResult>();
  const sport = venue?.sports[0]?.slug ?? 'basketball';
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (flow.step === 'COMPARING' || flow.step === 'DETAILS') event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [flow.step]);
  // Empty band (first entry in a sport): /entries already finalized it, so read the score from the list.
  const loadResultFromList = async (id: string) => { const list = await api.get<{ entries: { id: string; rallyScore: number | null; rankPosition: number | null }[] }>(`/me/list?sport=${sport}`); const mine = list.entries.find((entry) => entry.id === id); if (mine?.rallyScore != null && mine.rankPosition != null) setResult({ rallyScore: mine.rallyScore, rankPosition: mine.rankPosition, totalRanked: list.entries.length, beat: [] }); };
  const chooseSentiment = async (sentiment: Sentiment) => {
    if (!venue) return; setBusy(true);
    try {
      const created = await api.post<{ entry: { id: string }; session: { id: string; maxSteps: number }; nextPair: { opponentEntryId: string; opponent: { name: string } } | null }>('/entries', { venueId: venue.id, sportSlug: sport, sentiment, playedAt: new Date().toISOString(), tags: [] });
      setEntryId(created.entry.id); setSessionId(created.session.id); setMaxSteps(created.session.maxSteps); setNextPair(created.nextPair);
      dispatch({ type: 'sentiment', sentiment });
      if (!created.nextPair) { await loadResultFromList(created.entry.id); dispatch({ type: 'goto', step: 'DETAILS' }); }
    } catch (error) { toast(apiErrorMessage(error)); } finally { setBusy(false); }
  };
  const compare = async (winnerEntryId: string | null) => {
    if (!sessionId || !entryId) return; setBusy(true);
    try {
      const reply = await api.post<{ nextPair?: { opponentEntryId: string; opponent: { name: string } }; result?: RankResult }>('/comparisons', { sessionId, winnerEntryId: winnerEntryId === 'subject-entry' ? entryId : winnerEntryId });
      if (reply.result) { setResult(reply.result); dispatch({ type: 'goto', step: 'DETAILS' }); }
      else { setNextPair(reply.nextPair ?? null); dispatch({ type: 'advance' }); }
    } catch (error) { toast(apiErrorMessage(error)); } finally { setBusy(false); }
  };
  const skipRanking = async () => { if (!sessionId) return; setBusy(true); try { const reply = await api.post<{ result: RankResult }>(`/comparisons/session/${sessionId}/abandon`, {}); setResult(reply.result); dispatch({ type: 'goto', step: 'DETAILS' }); } catch (error) { toast(apiErrorMessage(error)); } finally { setBusy(false); } };
  // Persist the note/tags to the entry, then reveal. The reveal must reflect what's saved.
  const submitDetails = async (note: string, tags: string[]) => { if (entryId && (note.trim() || tags.length)) { try { await api.patch(`/entries/${entryId}`, { note: note.trim() || null, tags }); } catch (error) { toast(apiErrorMessage(error)); } } dispatch({ type: 'goto', step: 'REVEAL' }); };
  if (!venue) return <main className="p-5"><div className="mx-auto mt-24 h-32 max-w-xl animate-pulse rounded-card border border-rally-border bg-rally-surface" /></main>;
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col bg-rally-base p-4"><Link href={`/venue/${venue.id}`} className="mb-8 text-sm text-rally-secondary">← Cancel</Link>{flow.step === 'SENTIMENT' ? <SentimentScreen venue={venue.name} sport={sport} busy={busy} choose={chooseSentiment} /> : null}{flow.step === 'COMPARING' && nextPair ? <Comparison subject={venue.name} opponent={nextPair.opponent.name} opponentEntryId={nextPair.opponentEntryId} step={flow.comparison + 1} total={Math.max(maxSteps, flow.comparison + 1)} busy={busy} choose={compare} skip={skipRanking} /> : null}{flow.step === 'DETAILS' ? <Details sport={sport} busy={busy} submit={submitDetails} /> : null}{flow.step === 'REVEAL' ? <Reveal venue={venue.name} sport={sport} score={result?.rallyScore ?? 0} rank={result?.rankPosition ?? 0} total={result?.totalRanked ?? 0} beat={result?.beat ?? []} back={() => router.push('/')} viewList={() => router.push('/me')} /> : null}</main>;
}
const sportLabel = (sport: SportSlug) => sport.replace('_', ' ');
function SentimentScreen({ venue, sport, busy, choose }: { venue: string; sport: SportSlug; busy: boolean; choose: (value: Sentiment) => void }) { const choices: [Sentiment, string, string][] = [['LIKED', 'Liked it', `Add it to your favorite ${sportLabel(sport)} spots`], ['FINE', 'It was fine', 'A solid option, but not a favorite'], ['DISLIKED', "Didn't like it", 'Keep the signal honest']]; return <section className="my-auto"><p className="text-sm text-rally-secondary">LOG A VISIT · {sportLabel(sport)}</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">How was {venue}?</h1><div className="mt-8 space-y-3">{choices.map(([value, label, detail]) => <button key={value} disabled={busy} onClick={() => choose(value)} className="min-h-20 w-full rounded-card border border-rally-border bg-rally-surface p-5 text-left transition hover:border-emerald-400"><span className="block text-lg font-semibold">{label}</span><span className="mt-1 block text-sm text-rally-secondary">{detail}</span></button>)}</div></section>; }
function Comparison({ subject, opponent, opponentEntryId, step, total, busy, choose, skip }: { subject: string; opponent: string; opponentEntryId: string; step: number; total: number; busy: boolean; choose: (id: string | null) => void; skip: () => void }) { useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'ArrowLeft') choose('subject-entry'); if (event.key === 'ArrowRight') choose(opponentEntryId); if (event.key === ' ') { event.preventDefault(); choose(null); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [choose, opponentEntryId]); return <section className="my-auto"><p className="text-center text-sm text-rally-secondary">Comparison {step} of {total}</p><div className="mt-3 flex justify-center gap-2">{Array.from({ length: total }, (_, dot) => <span key={dot} className={`size-2 rounded-full ${dot < step ? 'bg-emerald-400' : 'bg-rally-border'}`} />)}</div><h1 className="mt-7 text-center text-3xl font-semibold">Which do you like better?</h1><div className="mt-8 grid gap-3 sm:grid-cols-2">{[[subject, 'subject-entry'], [opponent, opponentEntryId]].map(([name, id]) => <button disabled={busy} key={id} onClick={() => choose(id)} className="min-h-40 rounded-card border border-rally-border bg-rally-surface p-5 text-left text-xl font-semibold hover:border-emerald-400">{name}</button>)}</div><button disabled={busy} onClick={() => choose(null)} className="mt-4 min-h-11 w-full rounded-control border border-rally-border text-sm text-rally-secondary">Too close to call</button><button disabled={busy} onClick={skip} className="mt-6 w-full text-sm text-rally-tertiary underline">Skip ranking</button><p className="mt-4 hidden text-center text-xs text-rally-tertiary sm:block">← → choose · Space for too close</p></section>; }
function Details({ sport, busy, submit }: { sport: SportSlug; busy: boolean; submit: (note: string, tags: string[]) => void }) { const [note, setNote] = useState(''); const [tags, setTags] = useState<string[]>([]); const suggestions = sport === 'basketball' ? ['good runs', 'true rims', 'well lit', 'gets packed', 'no nets'] : sport === 'tennis' ? ['fast surface', 'windy', 'backboard'] : sport === 'pickleball' ? ['dedicated courts', 'lines taped', 'paddle rack'] : ['well kept', 'good lights', 'gets busy']; return <section className="my-auto"><h1 className="text-3xl font-semibold">Anything to remember?</h1><p className="mt-2 text-rally-secondary">Optional, but useful next time.</p><textarea maxLength={140} value={note} onChange={(event) => setNote(event.target.value)} className="mt-7 min-h-28 w-full rounded-card border border-rally-border bg-rally-surface p-4" placeholder="Great runs after 6…" /><p className="mt-2 text-right text-xs text-rally-tertiary">{note.length}/140</p><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((tag) => <button key={tag} onClick={() => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag])} className={`min-h-10 rounded-control border px-3 text-sm ${tags.includes(tag) ? 'border-emerald-400 bg-emerald-400/15' : 'border-rally-border'}`}>{tag}</button>)}</div><button disabled={busy} onClick={() => submit(note, tags)} className="mt-8 min-h-12 w-full rounded-control bg-emerald-400 font-semibold text-black disabled:opacity-50">{busy ? 'Saving…' : 'See my result'}</button></section>; }
function Reveal({ venue, sport, score, rank, total, beat, back, viewList }: { venue: string; sport: SportSlug; score: number; rank: number; total: number; beat: { name: string }[]; back: () => void; viewList: () => void }) { const [shown, setShown] = useState(0); useEffect(() => { const start = performance.now(); const frame = (now: number) => { const value = Math.min(1, (now - start) / 700); setShown(score * (1 - (1 - value) ** 3)); if (value < 1) requestAnimationFrame(frame); }; requestAnimationFrame(frame); }, [score]); const beaten = beat.slice(0, 2).map((item) => item.name); return <section className="my-auto text-center"><p className="text-sm text-rally-secondary">YOUR RALLY SCORE</p><p className="mt-2 text-6xl font-semibold tracking-tight text-emerald-400 tabular-nums">{shown.toFixed(1)}</p><p className="mt-5 text-lg">#{rank} of {total} {sportLabel(sport)}</p>{beaten.length ? <p className="mt-7 text-rally-secondary">You ranked {venue} above {beaten.join(' and ')}.</p> : <p className="mt-7 text-rally-secondary">{venue} is on your {sportLabel(sport)} list.</p>}<div className="mt-9 grid gap-2"><button onClick={back} className="min-h-12 rounded-control bg-emerald-400 font-semibold text-black">Back to map</button><button onClick={viewList} className="min-h-12 rounded-control border border-rally-border">View my list</button></div></section>; }
