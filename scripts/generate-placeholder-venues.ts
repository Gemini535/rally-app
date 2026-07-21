import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sportPhotos } from './data/photos.js';

type Sport = keyof typeof sportPhotos;
const neighborhoods = [
  ['Logan Square', 41.928, -87.706], ['Wicker Park', 41.908, -87.679], ['Lincoln Park', 41.922, -87.647], ['Lakeview', 41.944, -87.654], ['Rogers Park', 42.009, -87.668], ['Hyde Park', 41.794, -87.594], ['Pilsen', 41.857, -87.657], ['Bridgeport', 41.837, -87.646], ['West Loop', 41.883, -87.651], ['Uptown', 41.966, -87.658], ['Avondale', 41.939, -87.711], ['Albany Park', 41.968, -87.723], ['Andersonville', 41.981, -87.669], ['Humboldt Park', 41.902, -87.702], ['Bronzeville', 41.831, -87.618], ['South Loop', 41.858, -87.625], ['Irving Park', 41.953, -87.730], ['Beverly', 41.719, -87.676],
] as const;
const sports: { slug: Sport; label: string; surface: string; count: number }[] = [
  { slug: 'basketball', label: 'Basketball Courts', surface: 'ASPHALT', count: 2 }, { slug: 'pickleball', label: 'Pickleball Courts', surface: 'ASPHALT', count: 4 }, { slug: 'tennis', label: 'Tennis Courts', surface: 'ASPHALT', count: 4 }, { slug: 'soccer', label: 'Soccer Field', surface: 'GRASS', count: 1 }, { slug: 'volleyball', label: 'Volleyball Courts', surface: 'SAND', count: 2 }, { slug: 'baseball', label: 'Baseball Diamond', surface: 'GRASS', count: 1 }, { slug: 'softball', label: 'Softball Diamond', surface: 'GRASS', count: 1 }, { slug: 'running_track', label: 'Running Track', surface: 'RUBBER', count: 1 }, { slug: 'golf_range', label: 'Driving Range', surface: 'TURF', count: 12 }, { slug: 'skate', label: 'Skate Park', surface: 'CONCRETE', count: 1 }, { slug: 'football', label: 'Football Field', surface: 'TURF', count: 1 }, { slug: 'handball', label: 'Handball Courts', surface: 'CONCRETE', count: 2 },
];
const hash = (value: string) => [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);

async function main() {
  const venues = sports.flatMap((sport, sportIndex) => Array.from({ length: 15 }, (_, index) => {
    const [neighborhood, baseLat, baseLng] = neighborhoods[(sportIndex * 5 + index * 7) % neighborhoods.length];
    const osmId = `placeholder:${sport.slug}:${index + 1}`;
    const lights = (index + sportIndex) % 3 !== 0;
    const indoor = ['basketball', 'pickleball', 'handball'].includes(sport.slug) && index % 5 === 0;
    const photos = sportPhotos[sport.slug];
    const name = `${neighborhood} ${index % 2 === 0 ? 'Park' : 'Athletic Center'} ${sport.label}`;
    return { osmId, name, slug: `${neighborhood.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sport.slug}-${index + 1}`, lat: baseLat + ((index % 5) - 2) * 0.0024, lng: baseLng + ((Math.floor(index / 5)) - 1) * 0.0031, neighborhood, address: `${1200 + index * 17} ${['N Milwaukee Ave', 'W Division St', 'S Halsted St', 'N Clark St'][index % 4]}`, isIndoor: indoor, isFree: index % 6 !== 0, requiresReservation: index % 6 === 0, hasLights: lights, hasParking: index % 2 === 0, hasRestrooms: index % 3 !== 0, hasWater: index % 4 !== 0, photoUrl: photos[hash(osmId) % photos.length], sports: [{ slug: sport.slug, courtCount: sport.count, surface: indoor ? 'HARDWOOD' : sport.surface, isLit: lights }] };
  }));
  const output = join(process.cwd(), 'scripts', 'data', 'chicago-venues.normalized.json');
  await mkdir(join(process.cwd(), 'scripts', 'data'), { recursive: true });
  await writeFile(output, `${JSON.stringify(venues, null, 2)}\n`);
  console.log('PLACEHOLDER DATA: wrote 180 synthetic Chicago venues (15 per sport, 18 neighborhoods). Replace with normalized OSM data before the demo.');
}

void main();
