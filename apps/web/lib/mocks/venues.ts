import { VenueCardSchema, type VenueCard } from '@rally/shared';

const sports = ['basketball', 'pickleball', 'tennis', 'soccer'] as const;
const names = ['Logan Square Courts', 'Humboldt Park Hoops', 'Wicker Park Fieldhouse', 'Palmer Square Tennis', 'Union Park Courts', 'Margate Field', 'Skinner Park', 'Holstein Park', 'Oz Park', 'Horner Park', 'Eckhart Park', 'Chopin Park', 'Haas Park', 'Hamlin Park', 'McKinley Park', 'Harrison Park', 'Smith Park', 'Warren Park', 'Midway Plaisance', 'Jackson Park'];

export const mockVenues: VenueCard[] = names.map((name, index) => VenueCardSchema.parse({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, neighborhood: ['Logan Square', 'Wicker Park', 'Humboldt Park', 'Lincoln Park'][index % 4], city: 'Chicago', lat: 41.8781 + (index % 5) * .012, lng: -87.6298 - Math.floor(index / 5) * .014, photoUrl: null, distanceMeters: 700 + index * 270,
  sports: [{ slug: sports[index % sports.length], name: sports[index % sports.length].replace('_', ' '), colorHex: ['#F97316','#A3E635','#84CC16','#38BDF8'][index % 4], courtCount: index % 3 + 1, surface: index % 2 ? 'ASPHALT' : 'HARDWOOD' }],
  isIndoor: index % 5 === 0, isFree: index % 4 !== 0, hasLights: index % 3 !== 0, requiresReservation: index % 4 === 0,
  live: index % 3 === 0 ? { activeCount: index % 4 + 2, headcount: index % 4 + 4, gameType: 'PICKUP', skillLevel: 'INTERMEDIATE', lastCheckInAt: new Date().toISOString() } : null,
  myEntry: null, inWantToTry: false, cityElo: 1510 + index * 8,
  reco: { rallyScore: Number((9.5 - index * .22).toFixed(1)), components: { personal: .8, social: .7, proximity: .6, live: index % 3 === 0 ? .9 : null, gate: 1 }, gateReason: null, why: [index % 3 === 0 ? `${index % 4 + 4} here now · pickup` : `${((700 + index * 270) / 1609.34).toFixed(1)} mi away`] },
}));
