'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/empty-state';
type Sport = { slug: string; name: string; skillLevel: string; isPrimary: boolean };
type Profile = { displayName: string; handle: string; bio: string | null; homeCity: string; sports: Sport[]; followerCount: number; followingCount: number; entries: Entry[] };
type Entry = { id: string; sentiment: string; rallyScore: number | string | null; rankPosition: number | null; venue: { id: string; name: string; neighborhood: string | null } };
export default function MePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<{ user: Profile }>('/me') });
  const user = me.data?.user;
  if (me.isLoading) return <main className="p-5 text-rally-secondary">Loading your profile…</main>;
  if (!user) return <main className="p-5"><EmptyState icon="!" headline="Profile unavailable" body="Refresh your session and try again." /></main>;
  return <main className="mx-auto max-w-2xl p-5"><p className="text-sm text-rally-secondary">{user.homeCity}</p><h1 className="mt-1 text-3xl font-semibold">{user.displayName}</h1><p className="text-rally-secondary">@{user.handle}</p>{user.bio && <p className="mt-3 text-rally-secondary">{user.bio}</p>}<div className="mt-5 flex gap-6 text-sm"><span><b>{user.entries.length}</b> ranked</span><span><b>{user.followerCount}</b> followers</span><span><b>{user.followingCount}</b> following</span></div><div className="mt-7 flex gap-2 overflow-x-auto pb-1">{user.sports.map((item) => <span key={item.slug} className={`min-h-10 shrink-0 rounded-control border px-3 py-2 text-sm ${item.isPrimary ? 'border-emerald-400 text-emerald-400' : 'border-rally-border'}`}>{item.name} · {item.skillLevel.toLowerCase()}</span>)}</div><section className="mt-7"><h2 className="text-xl font-semibold">Your ranked list</h2>{user.entries.length ? <ol className="mt-4 divide-y divide-rally-border rounded-card border border-rally-border bg-rally-surface">{user.entries.map((entry) => <li key={entry.id}><Link href={`/venue/${entry.venue.id}`} className="flex items-center gap-3 p-4"><span className="w-6 text-rally-tertiary tabular-nums">{entry.rankPosition ?? '—'}</span><span className="min-w-0 flex-1"><b className="block truncate">{entry.venue.name}</b><small className="text-rally-secondary">{entry.venue.neighborhood ?? 'Chicago'} · {entry.sentiment.toLowerCase()}</small></span><strong className="tabular-nums text-emerald-400">{entry.rallyScore === null ? '—' : Number(entry.rallyScore).toFixed(1)}</strong></Link></li>)}</ol> : <EmptyState icon="⌁" headline="No rankings in this sport yet" body="Log a place you’ve played to start your list." cta={<Link href="/search" className="text-emerald-400">Find a venue</Link>} />}</section></main>;
}
