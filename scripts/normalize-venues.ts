import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { sportPhotos } from './data/photos.js';

type Raw = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type Sport = keyof typeof sportPhotos;
type Venue = { osmId: string; name: string; slug: string; lat: number; lng: number; neighborhood: string | null; address: string | null; isIndoor: boolean; isFree: boolean; requiresReservation: boolean; hasLights: boolean; hasParking: boolean; hasRestrooms: boolean; hasWater: boolean; photoUrl: string; sports: { slug: Sport; courtCount: number; surface: string | null; isLit: boolean | null }[]; tags: Record<string, string> };
const data = join(process.cwd(), 'scripts', 'data'); const valid = new Set(Object.keys(sportPhotos));
const map: Record<string, Sport> = { american_football: 'football', running: 'running_track', skateboard: 'skate' } as Record<string, Sport>;
const surfaces: Record<string, string> = { asphalt: 'ASPHALT', concrete: 'CONCRETE', clay: 'CLAY', grass: 'GRASS', artificial_turf: 'TURF', synthetic: 'TURF', wood: 'HARDWOOD', hardwood: 'HARDWOOD', tartan: 'RUBBER', rubber: 'RUBBER', sand: 'SAND' };
const stats = { noCoordinates: 0, noSport: 0, private: 0, unnamed: 0, duplicate: 0 };
const radians = (n: number) => n * Math.PI / 180;
const distance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => { const dLat = radians(b.lat - a.lat); const dLng = radians(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2; return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
const hash = (value: string) => [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
const kebab = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const infer = (sport: Sport, indoor: boolean) => indoor ? 'HARDWOOD' : ({ basketball: 'ASPHALT', tennis: 'ASPHALT', soccer: 'GRASS', running_track: 'RUBBER', volleyball: 'SAND' }[sport] ?? null);
const count = (tags: Record<string, string>) => { const raw = tags.hoops ?? tags.courts ?? tags.lanes; return raw ? Math.max(1, Number.parseInt(raw, 10) || 1) : 1; };

async function main() {
const raw = JSON.parse(await readFile(join(data, 'chicago-venues.raw.json'), 'utf8')) as { elements: Raw[] };
const geo = JSON.parse(await readFile(join(data, 'chicago-neighborhoods.geojson'), 'utf8')) as { features: { properties?: Record<string, unknown>; geometry: unknown }[] };
const parks = raw.elements.filter((element) => element.tags?.leisure === 'park').flatMap((element) => { const lat = element.lat ?? element.center?.lat; const lng = element.lon ?? element.center?.lon; return lat === undefined || lng === undefined ? [] : [{ lat, lng, name: element.tags?.name }]; });
const candidates: Venue[] = [];
for (const element of raw.elements) {
  const tags = element.tags ?? {}; const lat = element.lat ?? element.center?.lat; const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) { stats.noCoordinates += 1; continue; }
  const sports = (tags.sport ?? '').split(';').map((value) => map[value.trim()] ?? value.trim()).filter((value): value is Sport => valid.has(value));
  if (!sports.length) { stats.noSport += 1; continue; }
  if (tags.access === 'private' || tags.access === 'customers') { stats.private += 1; continue; }
  const nearbyPark = parks.find((park) => park.name && distance({ lat, lng }, park) <= 250);
  const name = tags.name ?? (nearbyPark?.name ? `${nearbyPark.name} — ${sports[0]} Courts` : undefined);
  if (!name) { stats.unnamed += 1; continue; }
  const isIndoor = tags.indoor === 'yes' || tags.leisure === 'sports_centre'; const surface = surfaces[tags.surface?.toLowerCase() ?? ''];
  const address = tags['addr:full'] ?? ([tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null);
  candidates.push({ osmId: `${element.type}/${element.id}`, name, slug: '', lat, lng, neighborhood: null, address, isIndoor, isFree: tags.fee !== 'yes', requiresReservation: tags.reservation === 'required' || tags.reservation === 'yes', hasLights: tags.lit === 'yes', hasParking: tags.parking === 'yes' || tags['parking:surface'] !== undefined, hasRestrooms: tags.toilets === 'yes', hasWater: tags.drinking_water === 'yes', photoUrl: '', sports: sports.map((slug) => ({ slug, courtCount: count(tags), surface: surface ?? infer(slug, isIndoor), isLit: tags.lit === undefined ? null : tags.lit === 'yes' })), tags });
}
const deduped: Venue[] = [];
for (const candidate of candidates.sort((a, b) => Object.keys(b.tags).length - Object.keys(a.tags).length)) { const match = deduped.find((venue) => distance(venue, candidate) <= 40 && venue.sports.some((sport) => candidate.sports.some((other) => other.slug === sport.slug))); if (!match) deduped.push(candidate); else { stats.duplicate += 1; for (const sport of candidate.sports) if (!match.sports.some((existing) => existing.slug === sport.slug)) match.sports.push(sport); } }
for (const venue of deduped) { const feature = geo.features.find((item) => booleanPointInPolygon(point([venue.lng, venue.lat]), item as never)); venue.neighborhood = feature ? String(feature.properties?.community ?? feature.properties?.COMMUNITY ?? feature.properties?.COMMUNITY_NAME ?? 'Unknown') : null; const photos = sportPhotos[venue.sports[0].slug]; venue.photoUrl = photos[hash(venue.osmId) % photos.length]; }
const chosen = new Set<Venue>();
for (const sport of valid) { const pool = deduped.filter((venue) => venue.sports.some((item) => item.slug === sport)).sort((a, b) => Object.keys(b.tags).length - Object.keys(a.tags).length); while (pool.length && [...chosen].filter((venue) => venue.sports.some((item) => item.slug === sport)).length < 30) { const selected = chosen.size ? pool.sort((a, b) => Math.min(...[...chosen].map((v) => distance(a, v))) - Math.min(...[...chosen].map((v) => distance(b, v)))) .pop() : pool.shift(); if (selected) { chosen.add(selected); pool.splice(pool.indexOf(selected), 1); } } }
const slugs = new Map<string, number>(); const output = [...chosen].map(({ tags, ...venue }) => { const base = kebab(`${venue.name}-${venue.sports[0].slug}`); const suffix = (slugs.get(base) ?? 0) + 1; slugs.set(base, suffix); return { ...venue, slug: suffix === 1 ? base : `${base}-${suffix}` }; });
await writeFile(join(data, 'chicago-venues.normalized.json'), `${JSON.stringify(output, null, 2)}\n`);
const perSport = Object.fromEntries([...valid].map((sport) => [sport, output.filter((venue) => venue.sports.some((item) => item.slug === sport)).length])); const perNeighborhood = Object.fromEntries(Object.entries(output.reduce<Record<string, number>>((result, venue) => { result[venue.neighborhood ?? 'Unknown'] = (result[venue.neighborhood ?? 'Unknown'] ?? 0) + 1; return result; }, {})).sort());
console.table(perSport); console.table(perNeighborhood); console.table({ surface: `${Math.round(output.filter((venue) => venue.sports.some((sport) => sport.surface)).length / output.length * 100)}%`, lights: `${Math.round(output.filter((venue) => venue.hasLights).length / output.length * 100)}%`, ...stats });
}

void main();
