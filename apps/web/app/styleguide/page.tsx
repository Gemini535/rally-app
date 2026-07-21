import { CircleOff } from 'lucide-react';
import { ScoreBadge } from '@/components/venue/score-badge';
import { LiveBadge } from '@/components/venue/live-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedSkeleton, ListSkeleton, VenueCardSkeleton } from '@/components/shared/loading-skeleton';
import { SportThemeProvider } from '@/components/sport-theme-provider';
import { notFound } from 'next/navigation';

export default function Styleguide() { if (process.env.NODE_ENV === 'production') notFound(); return <main className="mx-auto max-w-5xl space-y-10 p-6"><header><p className="text-sm uppercase tracking-[.2em] text-rally-tertiary">Rally</p><h1 className="mt-2 text-3xl font-semibold">Design system</h1></header><section className="grid gap-4 sm:grid-cols-3"><ScoreBadge score={9.1} rank={2} total={9} /><ScoreBadge score={6.7} /><ScoreBadge score={3.2} /></section><section className="flex flex-wrap gap-3"><LiveBadge count={7} gameType="COMPETITIVE" /><LiveBadge count={0} /></section><SportThemeProvider sport="basketball"><section className="rounded-card border p-5"><span className="inline-block size-6 rounded-full bg-[var(--sport-accent)]" /> <span className="ml-2">Sport accent</span></section></SportThemeProvider><section className="grid gap-4 md:grid-cols-3"><VenueCardSkeleton /><FeedSkeleton /><ListSkeleton /></section><EmptyState icon={<CircleOff />} headline="Nothing here yet" body="Every list has a clear empty state." /></main>; }
