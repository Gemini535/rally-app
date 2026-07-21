'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { AffinityExplanation } from '@rally/shared';
import { useRallyToast } from '@/app/providers';
import { api, apiErrorMessage } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/empty-state';

type User = { id: string; displayName: string; handle: string; bio: string | null; homeCity: string; followerCount: number; followingCount: number; isFollowing: boolean; sports: { slug: string; name: string; skillLevel: string }[] };
type Entry = { id: string; rallyScore: number | null; rankPosition: number | null; venue: { id: string; name: string } };

export default function UserProfilePage() {
  const { handle } = useParams<{ handle: string }>(); const client = useQueryClient(); const toast = useRallyToast(); const [open, setOpen] = useState(false);
  const profile = useQuery({ queryKey: ['user', handle], queryFn: () => api.get<{ user: User }>(`/users/${handle}`) });
  const sport = profile.data?.user.sports[0]?.slug;
  const list = useQuery({ queryKey: ['user-list', handle, sport], enabled: Boolean(sport), queryFn: () => api.get<{ entries: Entry[] }>(`/users/${handle}/list?sport=${sport}`) });
  const affinity = useQuery({ queryKey: ['affinity', handle], enabled: open, queryFn: () => api.get<{ affinity: AffinityExplanation }>(`/users/${handle}/affinity`) });
  const user = profile.data?.user;
  const toggleFollow = async () => { if (!user) return; try { if (user.isFollowing) await api.delete(`/follows/${user.id}`); else await api.post('/follows', { userId: user.id }); await client.invalidateQueries({ queryKey: ['user', handle] }); } catch (error) { toast(apiErrorMessage(error)); } };
  if (profile.isLoading) return <main className="p-5 text-rally-secondary">Loading player…</main>;
  if (!user) return <main className="p-5"><EmptyState icon="?" headline="Player not found" body="Try searching for another Rally handle." /></main>;
  return <main className="mx-auto max-w-2xl p-5"><p className="text-sm text-rally-secondary">{user.homeCity}</p><div className="mt-1 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">{user.displayName}</h1><p className="text-rally-secondary">@{user.handle}</p></div><button onClick={toggleFollow} className="min-h-11 rounded-control border border-emerald-400 px-4 text-sm text-emerald-400">{user.isFollowing ? 'Following' : 'Follow'}</button></div>{user.bio ? <p className="mt-4 text-rally-secondary">{user.bio}</p> : null}<p className="mt-5 text-sm"><b>{user.followerCount}</b> followers · <b>{user.followingCount}</b> following</p><button onClick={() => setOpen(true)} className="mt-4 min-h-11 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-4 text-sm text-emerald-400">Compare your court taste</button><div className="mt-5 flex flex-wrap gap-2">{user.sports.map((item) => <span className="rounded-full border border-rally-border px-3 py-1 text-sm" key={item.slug}>{item.name} · {item.skillLevel.toLowerCase()}</span>)}</div><section className="mt-8"><h2 className="text-xl font-semibold">Ranked places</h2>{list.data?.entries.length ? <div className="mt-4 divide-y divide-rally-border rounded-card border border-rally-border bg-rally-surface">{list.data.entries.map((entry) => <div className="flex items-center gap-3 p-4" key={entry.id}><span className="tabular-nums text-rally-tertiary">{entry.rankPosition ?? '—'}</span><b className="min-w-0 flex-1 truncate">{entry.venue.name}</b><strong className="tabular-nums text-emerald-400">{entry.rallyScore?.toFixed(1) ?? '—'}</strong></div>)}</div> : <EmptyState icon="⌁" headline="No rankings shared yet" body="Check back after this player logs a venue." />}</section>{open ? <AffinityModal data={affinity.data?.affinity} loading={affinity.isLoading} failed={affinity.isError} close={() => setOpen(false)} /> : null}</main>;
}

function AffinityModal({ data, loading, failed, close }: { data?: AffinityExplanation; loading: boolean; failed: boolean; close: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="Taste affinity" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section className="w-full max-w-lg rounded-card border border-rally-border bg-rally-surface p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-rally-secondary">TASTE AFFINITY</p><h2 className="mt-1 text-2xl font-semibold">How your lists line up</h2></div><button aria-label="Close affinity explainer" onClick={close} className="grid size-11 place-items-center rounded-control border border-rally-border"><X size={18} /></button></div>{loading ? <div className="mt-6 h-56 animate-pulse rounded-control bg-rally-elevated" /> : failed ? <EmptyState icon="⌁" headline="Not enough shared runs yet" body="Rank some of the same venues to compare your taste." /> : <AffinityScatter data={data ?? { tau: 0, overlapN: 0, points: [] }} />}</section></div>;
}

function AffinityScatter({ data }: { data: AffinityExplanation }) { const percent = Math.round((data.tau + 1) * 50); return <><p className="mt-4 text-sm text-rally-secondary">Kendall τ <strong className="text-rally-primary tabular-nums">{data.tau.toFixed(2)}</strong> across {data.overlapN} shared venues · {percent}% alignment</p><div className="relative mt-6 aspect-square rounded-control border border-rally-border bg-rally-base"><span className="absolute bottom-2 left-3 text-xs text-rally-secondary">Your rank →</span><span className="absolute left-2 top-3 -rotate-90 text-xs text-rally-secondary">Their rank →</span><div className="absolute inset-10 border-l border-b border-rally-border">{data.points.map((point) => <span key={point.venue.id} title={point.venue.name} className="absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/15" style={{ left: `${Math.min(92, point.mineRank * 18)}%`, bottom: `${Math.min(92, point.theirRank * 18)}%` }} />)}</div></div><p className="mt-4 text-sm text-rally-secondary">Dots near the diagonal mean you tend to put the same places near the top.</p></>;
}
