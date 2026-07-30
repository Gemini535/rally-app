import { prisma, searchVenues } from '@rally/db';
import { IDEAL_COUNT, type GameType, type SkillLevel, type SportSlug } from '@rally/shared';
import { shrunkElo, tasteAffinity } from './ranking/core.js';
import { geohash, getWeather, playabilityGate, type Weather } from './weather.js';

export type RecommendOptions = {
  viewerId: string; sportSlug: SportSlug; lat?: number; lng?: number;
  radiusMeters?: number; playableNow?: boolean; limit?: number;
  isIndoor?: boolean; isFree?: boolean; hasLights?: boolean; q?: string;
};

// Fixed 8-dim venue feature vector. Order is load-bearing: the viewer's taste vector is the
// rallyScore-weighted mean of the same vector over venues they've ranked.
const FEATURE_LABELS = ['indoor courts', 'free courts', 'lit courts', 'easy parking', 'spots with restrooms', 'reservable courts', 'that surface', 'multi-court spots'];
const SURFACE_BUCKET: Record<string, number> = { HARDWOOD: 1, RUBBER: 0.9, TURF: 0.75, CLAY: 0.6, ASPHALT: 0.5, CONCRETE: 0.45, GRASS: 0.4, SAND: 0.3, OTHER: 0.2 };

type Features = { isIndoor: boolean; isFree: boolean; hasLights: boolean; hasParking: boolean; hasRestrooms: boolean; requiresReservation: boolean };
function featureVector(venue: Features, courtCount: number, surface: string | null): number[] {
  // Unknown surface is neutral (0.5), not "worst" — absent data must not read as a bad attribute.
  return [venue.isIndoor ? 1 : 0, venue.isFree ? 1 : 0, venue.hasLights ? 1 : 0, venue.hasParking ? 1 : 0, venue.hasRestrooms ? 1 : 0, venue.requiresReservation ? 1 : 0, surface ? SURFACE_BUCKET[surface] ?? 0.2 : 0.5, Math.min(courtCount, 8) / 8];
}
function cosine(a: number[], b: number[]): number {
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function resolvedWeights() {
  return {
    personal: Number(process.env.RECO_W_PERSONAL ?? 0.35), social: Number(process.env.RECO_W_SOCIAL ?? 0.25),
    proximity: Number(process.env.RECO_W_PROXIMITY ?? 0.2), live: Number(process.env.RECO_W_LIVE ?? 0.2),
  };
}
const miles = (meters: number) => `${(meters / 1609.34).toFixed(1)} mi away`;

export async function getRecommendations(options: RecommendOptions) {
  const now = new Date();
  const weights = resolvedWeights();
  const d0Km = Number(process.env.RECO_PROXIMITY_D0_KM ?? 3);
  const limit = options.limit ?? 20;
  const sport = await prisma.sport.findUnique({ where: { slug: options.sportSlug } });
  if (!sport) return { items: [], weights };

  // 1. Candidate set from PostGIS (capped at 200), already filtered to the sport.
  const hits = await searchVenues({ lat: options.lat, lng: options.lng, radiusMeters: options.radiusMeters ?? 5_000, sportSlugs: [options.sportSlug], isIndoor: options.isIndoor, isFree: options.isFree, hasLights: options.hasLights, q: options.q, limit: 200 });
  if (!hits.length) return { items: [], weights };
  const ids = hits.map((hit) => hit.id);
  const distanceById = new Map(hits.map((hit) => [hit.id, hit.distanceMeters === null ? null : Math.round(hit.distanceMeters)]));

  // 2. Batch-load everything the blend needs — no per-venue queries below this point.
  const followeeIds = (await prisma.follow.findMany({ where: { followerId: options.viewerId }, select: { followeeId: true } })).map((row) => row.followeeId);
  const [venues, viewerEntries, followeeEntries, affinities, liveCheckIns, wantToTry, viewerSport, totalRanked] = await Promise.all([
    prisma.venue.findMany({ where: { id: { in: ids } }, include: { venueSports: { include: { sport: true } }, venueSportRatings: true } }),
    prisma.entry.findMany({ where: { userId: options.viewerId, sportId: sport.id }, include: { venue: { include: { venueSports: { where: { sportId: sport.id } } } } } }),
    followeeIds.length ? prisma.entry.findMany({ where: { userId: { in: followeeIds }, sportId: sport.id, venueId: { in: ids }, status: 'RANKED' }, include: { user: true } }) : Promise.resolve([]),
    followeeIds.length ? prisma.tasteAffinity.findMany({ where: { userAId: options.viewerId, userBId: { in: followeeIds }, sportId: sport.id } }) : Promise.resolve([]),
    prisma.checkIn.findMany({ where: { venueId: { in: ids }, sportId: sport.id, endedAt: null, expiresAt: { gt: now } }, orderBy: { startedAt: 'desc' } }),
    prisma.wantToTry.findMany({ where: { userId: options.viewerId, venueId: { in: ids }, sportId: sport.id }, select: { venueId: true } }),
    prisma.userSport.findUnique({ where: { userId_sportId: { userId: options.viewerId, sportId: sport.id } } }),
    prisma.entry.count({ where: { userId: options.viewerId, sportId: sport.id, status: 'RANKED' } }),
  ]);

  // 3. One weather fetch per unique 5-char geohash across the candidate set.
  const byGeohash = new Map<string, { lat: number; lng: number }>();
  for (const venue of venues) byGeohash.set(geohash(venue.lat, venue.lng), { lat: venue.lat, lng: venue.lng });
  const weatherByGeohash = new Map<string, Weather | null>(await Promise.all([...byGeohash].map(async ([key, point]) => [key, await getWeather(point.lat, point.lng)] as [string, Weather | null])));

  const affinityByUser = new Map(affinities.map((row) => [row.userBId, tasteAffinity(Number(row.tau), row.overlapN)]));
  const wantToTrySet = new Set(wantToTry.map((row) => row.venueId));
  const viewerEntryByVenue = new Map(viewerEntries.filter((entry) => entry.status === 'RANKED' && entry.rallyScore !== null).map((entry) => [entry.venueId, entry]));
  const liveByVenue = new Map<string, typeof liveCheckIns>();
  for (const checkIn of liveCheckIns) liveByVenue.set(checkIn.venueId, [...(liveByVenue.get(checkIn.venueId) ?? []), checkIn]);
  const followeeByVenue = new Map<string, typeof followeeEntries>();
  for (const entry of followeeEntries) followeeByVenue.set(entry.venueId, [...(followeeByVenue.get(entry.venueId) ?? []), entry]);

  // Viewer taste vector: rallyScore-weighted mean of their ranked venues' feature vectors.
  const ranked = viewerEntries.filter((entry) => entry.status === 'RANKED' && entry.rallyScore !== null);
  let tasteVector: number[] | null = null;
  if (ranked.length >= 2) {
    const acc = new Array(8).fill(0); let weightSum = 0;
    for (const entry of ranked) {
      const vs = entry.venue.venueSports[0];
      const vector = featureVector(entry.venue, vs?.courtCount ?? 1, vs?.surface ?? null);
      const weight = Number(entry.rallyScore);
      for (let i = 0; i < 8; i += 1) acc[i] += vector[i] * weight;
      weightSum += weight;
    }
    if (weightSum > 0) tasteVector = acc.map((value) => value / weightSum);
  }

  // Cold-start fallback needs min-max shrunkElo across the candidate set.
  const shrunkByVenue = new Map(venues.map((venue) => {
    const rating = venue.venueSportRatings.find((row) => row.sportId === sport.id);
    return [venue.id, rating ? shrunkElo(Number(rating.elo), rating.nComparisons) : 1500];
  }));
  const shrunkValues = [...shrunkByVenue.values()];
  const minShrunk = Math.min(...shrunkValues); const maxShrunk = Math.max(...shrunkValues);
  const normalizedElo = (venueId: string) => maxShrunk === minShrunk ? 0.5 : ((shrunkByVenue.get(venueId) ?? 1500) - minShrunk) / (maxShrunk - minShrunk);

  const items = venues.map((venue) => {
    const venueSport = venue.venueSports.find((row) => row.sportId === sport.id);
    const rating = venue.venueSportRatings.find((row) => row.sportId === sport.id);
    const distanceMeters = distanceById.get(venue.id) ?? null;
    const vector = featureVector(venue, venueSport?.courtCount ?? 1, venueSport?.surface ?? null);
    const mine = viewerEntryByVenue.get(venue.id);
    const active = liveByVenue.get(venue.id) ?? [];
    const friends = followeeByVenue.get(venue.id) ?? [];

    // --- personal ---
    let personal: number | null;
    let tasteLabel: string | null = null;
    if (mine) personal = Number(mine.rallyScore) / 10;
    else if (tasteVector) {
      personal = cosine(tasteVector, vector);
      let best = -1; let bestIndex = -1;
      for (let i = 0; i < 8; i += 1) { const contribution = tasteVector[i] * vector[i]; if (contribution > best) { best = contribution; bestIndex = i; } }
      if (bestIndex >= 0 && best > 0.25) tasteLabel = `Matches your taste in ${FEATURE_LABELS[bestIndex]}`;
    } else personal = normalizedElo(venue.id);

    // --- social: affinity-weighted mean of followees' scores ---
    let social: number | null = null;
    if (friends.length) {
      let weighted = 0; let affinitySum = 0;
      for (const entry of friends) { const affinity = affinityByUser.get(entry.userId) ?? 0.5; weighted += affinity * (Number(entry.rallyScore ?? 0) / 10); affinitySum += affinity; }
      social = affinitySum > 0 ? weighted / affinitySum : null;
    }

    // --- proximity ---
    const proximity = distanceMeters === null ? null : Math.exp(-(distanceMeters / 1000) / d0Km);

    // --- live: unknown (null) when nobody is checked in, NOT bad ---
    let live: number | null = null;
    let headcount = 0;
    if (active.length) {
      headcount = Math.max(...active.map((checkIn) => checkIn.headcount));
      const latest = active[0];
      const recency = Math.exp(-((now.getTime() - latest.startedAt.getTime()) / 60_000) / 45);
      const ideal = IDEAL_COUNT[options.sportSlug]; const sigma = ideal / 2;
      const crowdFit = Math.exp(-((headcount - ideal) ** 2) / (2 * sigma ** 2));
      const skillMatch = !viewerSport || active.some((checkIn) => checkIn.skillLevel === viewerSport.skillLevel || checkIn.skillLevel === 'ANY') ? 1 : 0.5;
      const preferred = (viewerSport?.preferredGameTypes ?? []) as GameType[];
      const typeMatch = preferred.length === 0 || active.some((checkIn) => preferred.includes(checkIn.gameType as GameType)) ? 1 : 0.7;
      live = recency * crowdFit * skillMatch * typeMatch;
    }

    // --- weather gate ---
    const weather = weatherByGeohash.get(geohash(venue.lat, venue.lng)) ?? null;
    const gate = playabilityGate(venue, weather, now);

    // --- blend: drop null signals, renormalize the remaining weights proportionally ---
    const signals: [keyof typeof weights, number | null][] = [['personal', personal], ['social', social], ['proximity', proximity], ['live', live]];
    const present = signals.filter(([, value]) => value !== null) as [keyof typeof weights, number][];
    const weightSum = present.reduce((sum, [key]) => sum + weights[key], 0);
    const base = weightSum > 0 ? present.reduce((sum, [key, value]) => sum + (weights[key] / weightSum) * value, 0) : 0;
    const rallyScore = 10 * base * gate.multiplier;

    // --- why: most-distinctive signal first, by weighted contribution ---
    const contributions = present.map(([key, value]) => ({ key, contribution: (weights[key] / weightSum) * value }))
      .sort((a, b) => b.contribution - a.contribution);
    const why: string[] = [];
    for (const { key } of contributions) {
      if (key === 'live' && active.length) why.push(`${headcount} here now · ${active[0].gameType.toLowerCase()}`);
      if (key === 'social' && friends.length) {
        const top = friends.slice().sort((a, b) => (a.rankPosition ?? 99) - (b.rankPosition ?? 99));
        const name = top[0].user.displayName.split(' ')[0];
        const inTopThree = (top[0].rankPosition ?? 99) <= 3;
        why.push(friends.length > 1
          ? `${name} and ${friends.length - 1} other${friends.length > 2 ? 's' : ''} rank this${inTopThree ? ' top-3' : ''}`
          : `${name} ranks this #${top[0].rankPosition}`);
      }
      if (key === 'personal') { if (mine) why.push(`You ranked this #${mine.rankPosition}`); else if (tasteLabel) why.push(tasteLabel); }
      if (key === 'proximity' && distanceMeters !== null) why.push(miles(distanceMeters));
    }
    if (gate.reason) why.unshift(gate.reason);

    return {
      id: venue.id, slug: venue.slug, name: venue.name, neighborhood: venue.neighborhood, city: venue.city, lat: venue.lat, lng: venue.lng, photoUrl: venue.photoUrl, distanceMeters,
      sports: venue.venueSports.map((row) => ({ slug: row.sport.slug, name: row.sport.name, colorHex: row.sport.colorHex, courtCount: row.courtCount, surface: row.surface })),
      isIndoor: venue.isIndoor, isFree: venue.isFree, hasLights: venue.hasLights, requiresReservation: venue.requiresReservation,
      live: active.length ? { activeCount: active.length, headcount, gameType: active[0].gameType, skillLevel: active[0].skillLevel, lastCheckInAt: active[0].startedAt.toISOString() } : null,
      myEntry: mine ? { rallyScore: Number(mine.rallyScore), rankPosition: mine.rankPosition as number, totalRanked } : null,
      inWantToTry: wantToTrySet.has(venue.id), cityElo: Number(rating?.elo ?? 1500),
      reco: { rallyScore: Number(rallyScore.toFixed(1)), components: { personal, social, proximity, live, gate: gate.multiplier }, gateReason: gate.reason, why: why.slice(0, 3) },
    };
  })
    .filter((item) => !options.playableNow || (item.live !== null && item.reco.components.gate >= 0.5))
    .sort((a, b) => b.reco.rallyScore - a.reco.rallyScore)
    .slice(0, limit);

  return { items, weights };
}
