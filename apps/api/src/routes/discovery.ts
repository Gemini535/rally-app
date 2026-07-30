import { Router, type Router as RouterType } from 'express';
import { prisma, searchVenues, type VenueSearchOptions } from '@rally/db';
import type { SportSlug } from '@rally/shared';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../middleware/error.js';
import { getRecommendations } from '../services/recommend.js';
import { shrunkElo, tasteAffinity } from '../services/ranking/core.js';
import { getWeather, playabilityGate } from '../services/weather.js';

const router: RouterType = Router();
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
type UserRow = { id: string; handle: string; displayName: string; avatarUrl: string | null };
const toMini = (user: UserRow) => ({ id: user.id, handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl });
const toReview = (review: { id: string; user: UserRow; venueId: string; sport: { slug: string }; body: string; photos: string[]; createdAt: Date }) => ({ id: review.id, user: toMini(review.user), venueId: review.venueId, sportSlug: review.sport.slug, body: review.body, photos: review.photos, createdAt: review.createdAt.toISOString() });
const toCheckIn = (checkIn: { id: string; user: UserRow; venue: { id: string; slug: string; name: string; neighborhood: string | null; city: string; photoUrl: string | null }; sport: { slug: string }; startedAt: Date; expiresAt: Date; endedAt: Date | null; headcount: number; gameType: string; skillLevel: string; note: string | null }) => ({ id: checkIn.id, user: toMini(checkIn.user), venue: { id: checkIn.venue.id, slug: checkIn.venue.slug, name: checkIn.venue.name, neighborhood: checkIn.venue.neighborhood, city: checkIn.venue.city, photoUrl: checkIn.venue.photoUrl }, sportSlug: checkIn.sport.slug, startedAt: checkIn.startedAt.toISOString(), expiresAt: checkIn.expiresAt.toISOString(), endedAt: checkIn.endedAt ? checkIn.endedAt.toISOString() : null, headcount: checkIn.headcount, gameType: checkIn.gameType, skillLevel: checkIn.skillLevel, note: checkIn.note });
const flag = (value: unknown) => value === 'true' ? true : undefined;
const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };

type Gate = { multiplier: number; reason: string | null };
const OPEN_GATE: Gate = { multiplier: 1, reason: null };

function card(venue: { id: string; slug: string; name: string; neighborhood: string | null; city: string; lat: number; lng: number; photoUrl: string | null; isIndoor: boolean; isFree: boolean; hasLights: boolean; requiresReservation: boolean; venueSports: { courtCount: number; surface: string | null; sport: { slug: string; name: string; colorHex: string } }[]; venueSportRatings: { elo: unknown }[]; checkIns: { headcount: number; gameType: string; skillLevel: string; startedAt: Date }[] }, distanceMeters: number | null = null, gate: Gate = OPEN_GATE) {
  const live = venue.checkIns[0]; const rating = venue.venueSportRatings[0];
  const headcount = venue.checkIns.length ? Math.max(...venue.checkIns.map((x) => x.headcount)) : 0;
  const base = Math.max(0, Math.min(10, 5 + (Number(rating?.elo ?? 1500) - 1500) / 100));
  const why: string[] = [];
  if (live) why.push(`${headcount} here now · ${live.gameType.toLowerCase()}`);
  if (distanceMeters !== null) why.push(`${(distanceMeters / 1609).toFixed(1)} mi away`);
  if (gate.reason) why.push(gate.reason);
  if (!why.length) why.push('Popular in Chicago');
  return {
    id: venue.id, slug: venue.slug, name: venue.name, neighborhood: venue.neighborhood, city: venue.city, lat: venue.lat, lng: venue.lng, photoUrl: venue.photoUrl, distanceMeters,
    sports: venue.venueSports.map((x) => ({ slug: x.sport.slug, name: x.sport.name, colorHex: x.sport.colorHex, courtCount: x.courtCount, surface: x.surface })),
    isIndoor: venue.isIndoor, isFree: venue.isFree, hasLights: venue.hasLights, requiresReservation: venue.requiresReservation,
    live: live ? { activeCount: venue.checkIns.length, headcount, gameType: live.gameType, skillLevel: live.skillLevel, lastCheckInAt: live.startedAt.toISOString() } : null,
    myEntry: null, inWantToTry: false, cityElo: Number(rating?.elo ?? 1500),
    reco: { rallyScore: Number((base * gate.multiplier).toFixed(1)), components: { personal: null, social: null, proximity: distanceMeters === null ? null : Math.exp(-distanceMeters / 3000), live: live ? 0.8 : null, gate: gate.multiplier }, gateReason: gate.reason, why: why.slice(0, 3) },
  };
}

const include = { venueSports: { include: { sport: true } }, venueSportRatings: true, checkIns: { where: { endedAt: null, expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' as const } } };

// Two-step by design: PostGIS returns ids + ST_Distance (Prisma can't type relations off a raw query),
// then one Prisma query hydrates relations. findMany ignores IN-order, so re-apply the distance order.
async function searchAndHydrate(options: VenueSearchOptions) {
  const hits = await searchVenues(options);
  if (!hits.length) return [];
  const rows = await prisma.venue.findMany({ where: { id: { in: hits.map((hit) => hit.id) } }, include });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return hits.flatMap((hit) => { const venue = byId.get(hit.id); return venue ? [{ venue, distanceMeters: hit.distanceMeters === null ? null : Math.round(hit.distanceMeters) }] : []; });
}

function searchOptionsFrom(query: Record<string, unknown>, sportSlugs?: string[]): VenueSearchOptions {
  return {
    lat: num(query.lat), lng: num(query.lng), radiusMeters: num(query.radius) ?? num(query.radiusMeters) ?? 5_000,
    sportSlugs, q: typeof query.q === 'string' && query.q.trim() ? query.q.trim() : undefined,
    isIndoor: flag(query.indoor) ?? flag(query.isIndoor), isFree: flag(query.free) ?? flag(query.isFree), hasLights: flag(query.hasLights) ?? flag(query.lights),
    limit: Math.min(num(query.limit) ?? 20, 50),
  };
}

router.get('/sports', asyncHandler(async (_req, res) => res.set('Cache-Control', 'public, max-age=3600').json({ items: await prisma.sport.findMany({ orderBy: { name: 'asc' } }) })));

router.get('/feed/recommended', requireAuth, asyncHandler(async (req, res) => {
  const options = searchOptionsFrom(req.query as Record<string, unknown>);
  res.json(await getRecommendations({
    viewerId: req.user!.id, sportSlug: (typeof req.query.sport === 'string' ? req.query.sport : 'basketball') as SportSlug,
    lat: options.lat, lng: options.lng, radiusMeters: options.radiusMeters, playableNow: req.query.playableNow === 'true',
    isIndoor: options.isIndoor, isFree: options.isFree, hasLights: options.hasLights, limit: options.limit,
  }));
}));

router.get('/venues', optionalAuth, asyncHandler(async (req, res) => {
  const sports = typeof req.query.sports === 'string' ? req.query.sports.split(',').filter(Boolean) : undefined;
  const rows = await searchAndHydrate(searchOptionsFrom(req.query as Record<string, unknown>, sports));
  res.json({ items: rows.map((row) => card(row.venue, row.distanceMeters)), nextCursor: null });
}));

router.get('/venues/:id', optionalAuth, asyncHandler(async (req, res) => {
  const venue = await prisma.venue.findUnique({ where: { id: param(req.params.id) }, include: { ...include, reviews: { include: { user: true, sport: true }, orderBy: { createdAt: 'desc' } }, checkIns: { include: { user: true, sport: true, venue: true }, where: { endedAt: null, expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } } } });
  if (!venue) throw notFound();
  const viewerId = req.user?.id ?? null;
  const primarySportId = venue.venueSports[0]?.sportId ?? null;
  const weather = await getWeather(venue.lat, venue.lng);
  const gate = playabilityGate(venue, weather, new Date());

  // City rank of this venue for its primary sport by shrunkElo (Elo shrunk toward 1500 by sample size).
  let cityRank: { rank: number; total: number } | null = null;
  if (primarySportId) {
    const ratings = await prisma.venueSportRating.findMany({ where: { sportId: primarySportId, venue: { city: venue.city } }, select: { venueId: true, elo: true, nComparisons: true } });
    const ordered = ratings.map((row) => ({ venueId: row.venueId, score: shrunkElo(Number(row.elo), row.nComparisons) })).sort((a, b) => b.score - a.score);
    const index = ordered.findIndex((row) => row.venueId === venue.id);
    if (index >= 0) cityRank = { rank: index + 1, total: ordered.length };
  }

  // Viewer personalization: their own ranked entry (+ note) and want-to-try state for this venue.
  let myEntry: { rallyScore: number; rankPosition: number; totalRanked: number } | null = null;
  let myNote: string | null = null;
  let inWantToTry = false;
  if (viewerId && primarySportId) {
    const [entry, totalRanked, wanted] = await Promise.all([
      prisma.entry.findFirst({ where: { userId: viewerId, venueId: venue.id, sportId: primarySportId } }),
      prisma.entry.count({ where: { userId: viewerId, sportId: primarySportId, status: 'RANKED' } }),
      prisma.wantToTry.findFirst({ where: { userId: viewerId, venueId: venue.id } }),
    ]);
    inWantToTry = Boolean(wanted);
    if (entry) { myNote = entry.note; if (entry.status === 'RANKED' && entry.rallyScore !== null && entry.rankPosition !== null) myEntry = { rallyScore: Number(entry.rallyScore), rankPosition: entry.rankPosition, totalRanked }; }
  }

  // Followees who ranked this venue for the primary sport, ordered by taste affinity desc.
  let friendRankings: { user: ReturnType<typeof toMini>; affinity: number; rallyScore: number; rankPosition: number; totalRanked: number; note: string | null }[] = [];
  if (viewerId && primarySportId) {
    const followeeIds = (await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followeeId: true } })).map((row) => row.followeeId);
    if (followeeIds.length) {
      const [entries, affinities] = await Promise.all([
        prisma.entry.findMany({ where: { userId: { in: followeeIds }, venueId: venue.id, sportId: primarySportId, status: 'RANKED', rankPosition: { not: null } }, include: { user: true } }),
        prisma.tasteAffinity.findMany({ where: { userAId: viewerId, userBId: { in: followeeIds }, sportId: primarySportId } }),
      ]);
      const affinityByUser = new Map(affinities.map((row) => [row.userBId, tasteAffinity(Number(row.tau), row.overlapN)]));
      const counts = entries.length ? await prisma.entry.groupBy({ by: ['userId'], where: { userId: { in: entries.map((entry) => entry.userId) }, sportId: primarySportId, status: 'RANKED' }, _count: { _all: true } }) : [];
      const totalByUser = new Map(counts.map((row) => [row.userId, row._count._all]));
      friendRankings = entries.map((entry) => ({ user: toMini(entry.user), affinity: affinityByUser.get(entry.userId) ?? 0.5, rallyScore: Number(entry.rallyScore), rankPosition: entry.rankPosition as number, totalRanked: totalByUser.get(entry.userId) ?? 0, note: entry.note })).sort((a, b) => b.affinity - a.affinity);
    }
  }

  const base = card({ ...venue, checkIns: venue.checkIns }, null, gate);
  res.json({ venue: { ...base, myEntry, inWantToTry, address: venue.address, state: venue.state, country: venue.country, hasParking: venue.hasParking, hasRestrooms: venue.hasRestrooms, hasWater: venue.hasWater, source: venue.source, conditionNotes: venue.venueSports[0]?.conditionNotes ?? null, weather, myNote, cityRank, friendRankings, reviews: venue.reviews.map(toReview), checkIns: venue.checkIns.map(toCheckIn) } });
}));

router.get('/venues/:id/live', optionalAuth, asyncHandler(async (req, res) => { const rows = await prisma.checkIn.findMany({ where: { venueId: param(req.params.id), endedAt: null, expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } }); res.json(rows.length ? { activeCount: rows.length, headcount: Math.max(...rows.map((x) => x.headcount)), gameType: rows[0].gameType, skillLevel: rows[0].skillLevel, lastCheckInAt: rows[0].startedAt.toISOString() } : null); }));

router.get('/leaderboard', optionalAuth, asyncHandler(async (req, res) => { const sport = String(req.query.sport ?? 'basketball'); const ratings = await prisma.venueSportRating.findMany({ where: { sport: { slug: sport as never } }, include: { venue: true, sport: true }, orderBy: [{ elo: 'desc' }, { nEntries: 'desc' }], take: Number(req.query.limit ?? 30) }); res.json({ items: ratings.map((rating, index) => ({ rank: index + 1, venue: { id: rating.venue.id, slug: rating.venue.slug, name: rating.venue.name, neighborhood: rating.venue.neighborhood, city: rating.venue.city, photoUrl: rating.venue.photoUrl }, sportSlug: rating.sport.slug, elo: Number(rating.elo), confidenceScore: rating.nComparisons / (rating.nComparisons + 8), nComparisons: rating.nComparisons, avgRallyScore: rating.avgRallyScore === null ? null : Number(rating.avgRallyScore), nEntries: rating.nEntries, movement: null })), nextCursor: null }); }));

export default router;
