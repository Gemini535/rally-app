import { notFound } from 'next/navigation';
import { VenueDetailSchema, type VenueDetail } from '@rally/shared';
import { mockVenueDetail } from '@/lib/mocks/venue-detail';
import { VenueDetailClient } from './venue-detail-client';

async function getVenue(id: string): Promise<VenueDetail> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return mockVenueDetail(id);
  const origin = process.env.NEXT_PUBLIC_API_URL;
  if (!origin) return mockVenueDetail(id);
  const response = await fetch(`${origin}/venues/${id}`, { cache: 'no-store' });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Unable to load this venue.');
  return VenueDetailSchema.parse(await response.json());
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const venue = await getVenue(params.id);
  return { title: `${venue.name} | Rally`, description: `${venue.name} in ${venue.neighborhood ?? venue.city}` };
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  return <VenueDetailClient initialVenue={await getVenue(params.id)} />;
}
