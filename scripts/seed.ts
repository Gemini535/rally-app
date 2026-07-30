import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// The seed is a long batch of writes (incl. interactive ranking transactions); run it on the
// direct session connection, not the pooled pgbouncer one where interactive transactions hang.
import { prismaDirect as prisma, setVenueGeom } from '@rally/db';
import { IDEAL_COUNT, type GameType, type SkillLevel, type SportSlug } from '@rally/shared';
import { createEntryAndSession, submitComparison } from '../apps/api/src/services/ranking/service.js';
import { recomputeAffinityFor } from '../apps/api/src/services/ranking/affinity.js';

type SeedVenue = { osmId: string; name: string; slug: string; lat: number; lng: number; neighborhood: string | null; address: string | null; isIndoor: boolean; isFree: boolean; requiresReservation: boolean; hasLights: boolean; hasParking: boolean; hasRestrooms: boolean; hasWater: boolean; photoUrl: string; sports: { slug: SportSlug; courtCount: number; surface: never; isLit: boolean | null }[] };
type Person = { handle: string; name: string; sports: SportSlug[]; skill: SkillLevel; lat: number; lng: number };
const seed = 20260721; let state = seed;
const random = () => { state |= 0; state = state + 0x6d2b79f5 | 0; let value = Math.imul(state ^ state >>> 15, 1 | state); value ^= value + Math.imul(value ^ value >>> 7, 61 | value); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const shuffle = <T>(items: T[]) => { const output = [...items]; for (let index = output.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [output[index], output[other]] = [output[other], output[index]]; } return output; };
const distance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot(a.lat - b.lat, a.lng - b.lng) * 111;
const sports: { slug: SportSlug; name: string; iconKey: string; colorHex: string; outdoor: boolean }[] = [
  ['basketball','Basketball','CircleDot','#F97316',true],['pickleball','Pickleball','Trophy','#A3E635',true],['tennis','Tennis','CircleDot','#84CC16',true],['soccer','Soccer','Goal','#38BDF8',true],['volleyball','Volleyball','CircleDot','#A78BFA',true],['baseball','Baseball','CircleDot','#F472B6',true],['softball','Softball','CircleDot','#FB7185',true],['running_track','Running Track','Route','#22D3EE',true],['golf_range','Golf Range','Flag','#34D399',true],['skate','Skate','Zap','#FBBF24',true],['football','Football','Trophy','#60A5FA',true],['handball','Handball','CircleDot','#F87171',true],
].map(([slug,name,iconKey,colorHex,outdoor]) => ({ slug: slug as SportSlug, name, iconKey, colorHex, outdoor }));
const homes = [[41.918,-87.652],[41.949,-87.675],[41.878,-87.630],[41.968,-87.688],[41.790,-87.600],[41.900,-87.720],[41.820,-87.680],[41.999,-87.660],[41.740,-87.610],[41.920,-87.700],[41.860,-87.650],[41.940,-87.640]];
export const people: Person[] = [
  { handle: 'marcus', name: 'Marcus Reed', sports: ['basketball','football'], skill: 'ADVANCED', ...toHome(0) }, { handle: 'priya', name: 'Priya Shah', sports: ['pickleball','tennis'], skill: 'INTERMEDIATE', ...toHome(1) },
  ...Array.from({ length: 16 }, (_, index) => { const profiles: [SportSlug[], SkillLevel][] = [[['basketball'],'ADVANCED'],[['basketball'],'INTERMEDIATE'],[['pickleball','tennis'],'INTERMEDIATE'],[['tennis'],'ADVANCED'],[['soccer'],'ADVANCED'],[['basketball','soccer','volleyball'],'ANY']]; const [userSports, skill] = profiles[index % profiles.length]; return { handle: `rally${index + 1}`, name: ['Jordan Kim','Avery Clark','Noah Patel','Sofia Rivera','Theo Martin','Maya Chen'][index % 6], sports: userSports, skill, ...toHome(index % homes.length) }; }),
];
function toHome(index: number) { const [lat, lng] = homes[index]; return { lat, lng }; }
async function adminUser(person: Person) {
  const password = process.env.DEMO_PASSWORD; const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password || !url || !key) throw new Error('DEMO_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.');
  const email = `${person.handle}@rally.demo`; const response = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) });
  const json = await response.json() as { id?: string; msg?: string }; if (response.ok && json.id) return json.id;
  if (!json.msg?.toLowerCase().includes('already')) throw new Error(json.msg ?? 'Could not create auth user.');
  const listed = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!listed.ok) throw new Error(`Could not list auth users: ${listed.status}.`);
  const users = (await listed.json() as { users?: { id: string; email?: string | null }[] }).users ?? [];
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`Could not resolve the existing auth user for ${email}.`);
  return existing.id;
}
async function seedVenues() {
  const venues = JSON.parse(await readFile(join(process.cwd(), 'scripts/data/chicago-venues.normalized.json'), 'utf8')) as SeedVenue[]; const quality = new Map<string, number>();
  if (venues.some((venue) => venue.osmId.startsWith('placeholder:'))) console.warn('\n⚠ PLACEHOLDER VENUE DATA IN USE — synthetic Chicago venues, not OSM data. Replace scripts/data/chicago-venues.normalized.json before the demo.\n');
  for (const venue of venues) { const record = await prisma.venue.upsert({ where: { osmId: venue.osmId }, create: { osmId: venue.osmId, name: venue.name, slug: venue.slug, lat: venue.lat, lng: venue.lng, neighborhood: venue.neighborhood, address: venue.address, isIndoor: venue.isIndoor, isFree: venue.isFree, requiresReservation: venue.requiresReservation, hasLights: venue.hasLights, hasParking: venue.hasParking, hasRestrooms: venue.hasRestrooms, hasWater: venue.hasWater, photoUrl: venue.photoUrl }, update: { name: venue.name, slug: venue.slug } }); await setVenueGeom(prisma, record.id, venue.lat, venue.lng); quality.set(record.id, (random() + random() + random() + random() + random()) / 5); for (const item of venue.sports) { const sport = await prisma.sport.findUniqueOrThrow({ where: { slug: item.slug } }); await prisma.venueSport.upsert({ where: { venueId_sportId: { venueId: record.id, sportId: sport.id } }, create: { venueId: record.id, sportId: sport.id, courtCount: item.courtCount, surface: item.surface, isLit: item.isLit }, update: {} }); await prisma.venueSportRating.upsert({ where: { venueId_sportId: { venueId: record.id, sportId: sport.id } }, create: { venueId: record.id, sportId: sport.id }, update: {} }); } }
  return quality;
}
async function rankUser(person: Person, id: string, quality: Map<string, number>) { const available = await prisma.venue.findMany({ where: { venueSports: { some: { sport: { slug: { in: person.sports } } } } }, include: { venueSports: { include: { sport: true } } } }); const picks = available.sort((a,b) => Math.exp(-distance(person,a)/4) - Math.exp(-distance(person,b)/4)).slice(-Math.min(10, available.length)); const scores = new Map(picks.map((venue) => [venue.id, (quality.get(venue.id) ?? .5) + random() * .2])); for (const venue of shuffle(picks)) { const sport = venue.venueSports.find((item) => person.sports.includes(item.sport.slug))!.sport.slug; const ordered = [...scores.entries()].sort((a,b) => b[1]-a[1]); const position = ordered.findIndex(([venueId]) => venueId === venue.id); const sentiment = position < Math.ceil(ordered.length*.45) ? 'LIKED' : position < Math.ceil(ordered.length*.85) ? 'FINE' : 'DISLIKED'; const created = await createEntryAndSession(id, venue.id, sport, sentiment, { tags: [], playedAt: new Date() }); let session = created.session; while (session.status === 'ACTIVE') { const band = await prisma.entry.findMany({ where: { userId: id, sport: { slug: sport }, sentiment, status: 'RANKED' }, orderBy: { rankPosition: 'asc' } }); const mid = Math.floor((session.lo + session.hi)/2); const opponent = band[mid]; const answer = opponent && (scores.get(venue.id)! > (scores.get(opponent.venueId) ?? .5)) ? created.entry.id : opponent?.id ?? created.entry.id; const next = await submitComparison(id, session.id, random() < .05 ? null : answer); if ('result' in next) break; session = await prisma.comparisonSession.findUniqueOrThrow({ where: { id: session.id } }); } } }
function poisson(lambda: number) { const limit = Math.exp(-lambda); let k = 0; let product = 1; do { k += 1; product *= random(); } while (product > limit); return k - 1; }
const gameTypeFor = (skill: SkillLevel): GameType => skill === 'ADVANCED' ? (random() < .6 ? 'COMPETITIVE' : 'PICKUP') : skill === 'BEGINNER' ? (random() < .6 ? 'CASUAL' : 'DRILLS') : (random() < .6 ? 'PICKUP' : 'CASUAL');

const reviewOpeners: Partial<Record<SportSlug, string[]>> = {
  basketball: ['Solid runs here.', 'Good pickup most evenings.', 'Rims are true and the court holds up.'],
  pickleball: ['Dedicated courts, lines are taped clean.', 'Easy to get a game going.', 'Paddle rack fills up fast.'],
  tennis: ['Surface plays fair.', 'Good hitting spot.', 'Rarely have to wait for a court.'],
  soccer: ['Full-sized pitch, decent turf.', 'Good for a weekend kickabout.'],
  volleyball: ['Nets stay up and taut.', 'Fun open-gym vibe.'],
};
function reviewBody(venue: { hasLights: boolean; isIndoor: boolean; isFree: boolean }, surface: string | null, slug: SportSlug, quality: number): string {
  const parts = [pick(reviewOpeners[slug] ?? ['Worth a visit.', 'Reliable spot to play.'])];
  if (surface) parts.push(`The ${surface.toLowerCase()} surface plays true.`);
  if (venue.hasLights) parts.push('Lights mean you can run after dark.');
  if (quality > 0.72) parts.push('Gets packed on weekends — come early.');
  else if (quality < 0.32) parts.push('Almost never crowded.');
  if (venue.isIndoor) parts.push('Nice to have an indoor option in winter.');
  return parts.slice(0, 3).join(' ');
}

// ~5 follows/user via 0.6*sharedSportOverlap + 0.4*proximity; demo accounts get >=6 incl. >=2 high list-overlap.
export async function seedFollows(ids: Map<string, string>) {
  const rankedByUser = new Map<string, Set<string>>();
  for (const [, id] of ids) rankedByUser.set(id, new Set((await prisma.entry.findMany({ where: { userId: id, status: 'RANKED' }, select: { venueId: true } })).map((entry) => entry.venueId)));
  const made = new Set<string>();
  const follow = async (a: string, b: string) => { if (a === b || made.has(`${a}|${b}`)) return; made.add(`${a}|${b}`); await prisma.follow.upsert({ where: { followerId_followeeId: { followerId: a, followeeId: b } }, create: { followerId: a, followeeId: b }, update: {} }); await prisma.activity.create({ data: { actorId: a, type: 'FOLLOWED', targetUserId: b, payload: {} } }); };
  for (const person of people) {
    const a = ids.get(person.handle)!;
    const scored = people.filter((other) => other.handle !== person.handle).map((other) => { const shared = person.sports.filter((slug) => other.sports.includes(slug)).length; const overlap = shared / new Set([...person.sports, ...other.sports]).size; return { id: ids.get(other.handle)!, score: 0.6 * overlap + 0.4 * Math.exp(-distance(person, other) / 8) }; }).sort((x, y) => y.score - x.score);
    const demo = person.handle === 'marcus' || person.handle === 'priya';
    const chosen = new Set(scored.slice(0, demo ? 6 : 5).map((entry) => entry.id));
    if (demo) { const mine = rankedByUser.get(a)!; const byOverlap = [...ids.values()].filter((id) => id !== a).map((id) => ({ id, n: [...rankedByUser.get(id)!].filter((venueId) => mine.has(venueId)).length })).sort((x, y) => y.n - x.n); for (const top of byOverlap.slice(0, 2)) chosen.add(top.id); for (const entry of scored) { if (chosen.size >= 6) break; chosen.add(entry.id); } }
    for (const b of chosen) await follow(a, b);
  }
}

// Reviews on ~25% of ranked entries; text only mentions attributes the venue actually has.
export async function seedReviews(quality: Map<string, number>) {
  const entries = await prisma.entry.findMany({ where: { status: 'RANKED' }, include: { venue: { include: { venueSports: true } }, sport: true } });
  for (const entry of entries) {
    if (random() >= 0.25) continue;
    const venueSport = entry.venue.venueSports.find((item) => item.sportId === entry.sportId);
    const body = reviewBody(entry.venue, venueSport?.surface ?? null, entry.sport.slug, quality.get(entry.venueId) ?? 0.5);
    const review = await prisma.review.create({ data: { userId: entry.userId, venueId: entry.venueId, sportId: entry.sportId, body, photos: [] } });
    await prisma.activity.create({ data: { actorId: entry.userId, type: 'REVIEWED', venueId: entry.venueId, sportId: entry.sportId, payload: { reviewId: review.id } } });
  }
}

// ~400 completed check-ins over the trailing 14 days with a realistic hour-of-day distribution.
export async function seedHistoricalCheckIns(ids: Map<string, string>) {
  const sportRows = await prisma.sport.findMany();
  const sportId = new Map(sportRows.map((sport) => [sport.slug, sport.id]));
  const venuesBySport = new Map<SportSlug, string[]>();
  for (const sport of sportRows) venuesBySport.set(sport.slug, (await prisma.venueSport.findMany({ where: { sportId: sport.id }, select: { venueId: true } })).map((row) => row.venueId));
  const now = Date.now();
  const rows: { userId: string; venueId: string; sportId: string; startedAt: Date; expiresAt: Date; endedAt: Date; headcount: number; gameType: GameType; skillLevel: SkillLevel }[] = [];
  for (let index = 0; index < 400; index += 1) {
    const person = pick(people); const slug = pick(person.sports); const venues = venuesBySport.get(slug);
    if (!venues?.length) continue;
    const date = new Date(now - Math.floor(random() * 14) * 86_400_000);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const hour = weekend ? 10 + Math.floor(random() * 4) : random() < 0.5 ? 6 + Math.floor(random() * 2) : 17 + Math.floor(random() * 3);
    date.setHours(hour, Math.floor(random() * 60), 0, 0);
    const startedAt = date;
    rows.push({ userId: ids.get(person.handle)!, venueId: pick(venues), sportId: sportId.get(slug)!, startedAt, expiresAt: new Date(startedAt.getTime() + 120 * 60_000), endedAt: new Date(startedAt.getTime() + (60 + Math.floor(random() * 60)) * 60_000), headcount: Math.max(1, poisson(IDEAL_COUNT[slug])), gameType: gameTypeFor(person.skill), skillLevel: person.skill });
  }
  await prisma.checkIn.createMany({ data: rows });
}

// 2-4 want-to-try per user, preferring venues their followees rank top-3, then filling from own-sport venues.
export async function seedWantToTry(ids: Map<string, string>) {
  const sportRows = await prisma.sport.findMany(); const sportId = new Map(sportRows.map((sport) => [sport.slug, sport.id]));
  for (const person of people) {
    const id = ids.get(person.handle)!;
    const ranked = new Set((await prisma.entry.findMany({ where: { userId: id }, select: { venueId: true } })).map((entry) => entry.venueId));
    const followeeIds = (await prisma.follow.findMany({ where: { followerId: id }, select: { followeeId: true } })).map((row) => row.followeeId);
    const friendTop = await prisma.entry.findMany({ where: { userId: { in: followeeIds }, status: 'RANKED', rankPosition: { lte: 3 }, sport: { slug: { in: person.sports } } }, orderBy: { rankPosition: 'asc' } });
    const chosen: { venueId: string; sportId: string; source: string }[] = []; const seen = new Set<string>();
    for (const entry of friendTop) { if (chosen.length >= 4) break; if (ranked.has(entry.venueId) || seen.has(entry.venueId)) continue; seen.add(entry.venueId); chosen.push({ venueId: entry.venueId, sportId: entry.sportId, source: 'friend-top-ranked' }); }
    if (chosen.length < 2) { const extra = await prisma.venueSport.findMany({ where: { sportId: sportId.get(person.sports[0])!, venueId: { notIn: [...ranked, ...seen] } }, take: 6, select: { venueId: true, sportId: true } }); for (const row of shuffle(extra)) { if (chosen.length >= 3) break; if (seen.has(row.venueId)) continue; seen.add(row.venueId); chosen.push({ venueId: row.venueId, sportId: row.sportId, source: 'discovery' }); } }
    for (const item of chosen) { await prisma.wantToTry.upsert({ where: { userId_venueId_sportId: { userId: id, venueId: item.venueId, sportId: item.sportId } }, create: { userId: id, venueId: item.venueId, sportId: item.sportId, source: item.source }, update: {} }); await prisma.activity.create({ data: { actorId: id, type: 'WANT_TO_TRY', venueId: item.venueId, sportId: item.sportId, payload: {} } }); }
  }
}

export async function refreshLiveCheckIns(): Promise<void> {
  await prisma.checkIn.updateMany({ where: { endedAt: null }, data: { endedAt: new Date() } });
  const users = await prisma.user.findMany({ where: { isDemo: true }, include: { userSports: { include: { sport: true } } } });
  const demos = users.filter((user) => user.handle === 'marcus' || user.handle === 'priya');
  const roster = [...demos, ...shuffle(users.filter((user) => user.handle !== 'marcus' && user.handle !== 'priya'))].filter((user) => user.userSports.length).slice(0, 10);
  for (const user of roster) {
    const sport = pick(user.userSports).sport;
    const candidates = await prisma.venueSport.findMany({ where: { sportId: sport.id }, select: { venueId: true }, take: 50 });
    const venueId = pick(candidates).venueId;
    const startedAt = new Date(Date.now() - (5 + Math.floor(random() * 70)) * 60_000);
    const checkIn = await prisma.checkIn.create({ data: { userId: user.id, venueId, sportId: sport.id, startedAt, expiresAt: new Date(startedAt.getTime() + 120 * 60_000), headcount: Math.max(1, IDEAL_COUNT[sport.slug] + Math.floor(random() * 5) - 2), gameType: gameTypeFor(user.userSports[0].skillLevel), skillLevel: user.userSports[0].skillLevel } });
    await prisma.activity.create({ data: { actorId: user.id, type: 'CHECKED_IN', venueId, sportId: sport.id, checkInId: checkIn.id, createdAt: startedAt, payload: {} } });
    console.log(`live check-in · ${user.handle}: ${checkIn.headcount} players`);
  }
}
async function resetSeedUsers() {
  await prisma.user.deleteMany();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --reset.');
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Could not list Supabase auth users for reset: ${response.status}.`);
  const demoEmails = new Set(people.map((person) => `${person.handle}@rally.demo`));
  const users = (await response.json() as { users?: { id: string; email?: string | null }[] }).users ?? [];
  await Promise.all(users.filter((user) => user.email && demoEmails.has(user.email)).map(async (user) => {
    const deleted = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!deleted.ok) throw new Error(`Could not delete demo auth user ${user.id}: ${deleted.status}.`);
  }));
  console.log('Deleted public.users (cascading all user-derived rows) and matching demo Supabase auth users; venues and sports were preserved.');
}
async function main() { if (process.argv.includes('--live-only')) return refreshLiveCheckIns(); if (process.argv.includes('--reset')) await resetSeedUsers(); for (const sport of sports) await prisma.sport.upsert({ where: { slug: sport.slug }, create: { slug: sport.slug, name: sport.name, iconKey: sport.iconKey, colorHex: sport.colorHex, defaultIsOutdoor: sport.outdoor }, update: { slug: sport.slug, name: sport.name, iconKey: sport.iconKey, colorHex: sport.colorHex, defaultIsOutdoor: sport.outdoor } }); const quality = await seedVenues(); const ids = new Map<string,string>(); for (const person of people) { const id = await adminUser(person); ids.set(person.handle,id); await prisma.user.upsert({ where: { id }, create: { id, handle: person.handle, displayName: person.name, avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${person.handle}`, homeLat: person.lat, homeLng: person.lng, isDemo: true }, update: { handle: person.handle, displayName: person.name, isDemo: true } }); for (const slug of person.sports) { const sport = await prisma.sport.findUniqueOrThrow({where:{slug}}); await prisma.userSport.upsert({where:{userId_sportId:{userId:id,sportId:sport.id}},create:{userId:id,sportId:sport.id,skillLevel:person.skill,preferredGameTypes:['PICKUP'],isPrimary:slug===person.sports[0]},update:{}}); } await rankUser(person,id,quality); }
  await seedFollows(ids);
  await seedReviews(quality);
  await seedHistoricalCheckIns(ids);
  await seedWantToTry(ids);
  await refreshLiveCheckIns();
  // Affinity is computed over follow edges, so it must run after seedFollows.
  for (const [handle, id] of ids) for (const slug of people.find((person) => person.handle === handle)!.sports) await recomputeAffinityFor(id, slug);
  const [users, venues, entries, comparisons, checkIns, follows, reviews, wantToTry, affinities, activities] = await prisma.$transaction([prisma.user.count(), prisma.venue.count(), prisma.entry.count(), prisma.comparison.count(), prisma.checkIn.count(), prisma.follow.count(), prisma.review.count(), prisma.wantToTry.count(), prisma.tasteAffinity.count(), prisma.activity.count()]);
  console.log(JSON.stringify({ users, venues, entries, comparisons, checkIns, follows, reviews, wantToTry, affinities, activities }, null, 2));
}
// Only auto-run when executed directly (so the seed helpers can be imported by tests/harnesses).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().finally(() => prisma.$disconnect());
