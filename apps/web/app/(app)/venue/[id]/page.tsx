import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { VenueDetailSchema, type VenueDetail } from '@rally/shared';
import { mockVenueDetail } from '@/lib/mocks/venue-detail';
import { VenueDetailClient } from './venue-detail-client';

async function getVenue(id: string): Promise<VenueDetail> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return mockVenueDetail(id);
  const configuredOrigin = process.env.NEXT_PUBLIC_API_URL;
  const origin = configuredOrigin?.startsWith('http') ? configuredOrigin : 'http://localhost:3000/api';
  // Forward the Supabase session cookie so the API can personalize (myEntry, want-to-try, friend rankings).
  const cookieHeader = (await cookies()).getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const response = await fetch(`${origin}/venues/${id}`, { cache: 'no-store', headers: cookieHeader ? { cookie: cookieHeader } : {} });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Unable to load this venue.');
  const payload = await response.json() as { venue: VenueDetail };
  return VenueDetailSchema.parse(payload.venue);
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const venue = await getVenue(params.id);
  return { title: `${venue.name} | Rally`, description: `${venue.name} in ${venue.neighborhood ?? venue.city}` };
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  return <VenueDetailClient initialVenue={await getVenue(params.id)} />;
}
