import { VenueDetailSchema, type VenueDetail } from '@rally/shared';
import { mockVenues } from './venues';

export function mockVenueDetail(id: string): VenueDetail {
  const card = mockVenues.find((venue) => venue.id === id) ?? mockVenues[0];
  return VenueDetailSchema.parse({
    ...card, address: 'Chicago Park District', state: 'IL', country: 'US', hasParking: true,
    hasRestrooms: true, hasWater: true, source: 'DEMO_FIXTURE', conditionNotes: null,
    reviews: [], checkIns: [],
  });
}
