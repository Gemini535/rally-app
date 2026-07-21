'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/empty-state';
type Activity = { id: string; type: string; actor: { displayName: string; handle: string }; venue: { id: string; name: string } | null; createdAt: string };
export default function FeedPage() {
  const query = useQuery({ queryKey: ['social-feed'], queryFn: () => api.get<{ items: Activity[] }>('/feed/social'), refetchOnWindowFocus: true });
  return <main className="mx-auto max-w-2xl p-5"><h1 className="text-3xl font-semibold">Your feed</h1><p className="mt-2 text-rally-secondary">Recent activity from players you follow.</p><div className="mt-6 space-y-3">{query.isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-card border border-rally-border bg-rally-surface p-4"><div className="h-4 w-40 rounded bg-rally-elevated" /><div className="mt-3 h-4 w-2/3 rounded bg-rally-elevated" /><div className="mt-5 h-3 w-24 rounded bg-rally-elevated" /></div>) : query.data?.items.length ? query.data.items.map((item) => <article key={item.id} className="rounded-card border border-rally-border bg-rally-surface p-4"><p><b>{item.actor.displayName}</b> <span className="text-rally-secondary">{item.type.toLowerCase().replace('_', ' ')}</span></p>{item.venue && <Link href={`/venue/${item.venue.id}`} className="mt-2 block font-medium text-emerald-400">{item.venue.name}</Link>}<p className="mt-2 text-xs text-rally-tertiary">{new Date(item.createdAt).toLocaleString()}</p></article>) : <EmptyState icon="✦" headline="Your feed is quiet" body="Follow players to see their court calls and check-ins." />}</div></main>;
}
