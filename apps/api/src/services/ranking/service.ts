import { prisma } from '@rally/db';
import type { Prisma } from '@rally/db';
import type { Sentiment, SportSlug } from '@rally/shared';
import { applyComparisonResult, eloUpdate, globalPositions, maxSteps, nextComparisonIndex, rescoreBand, resolveInsertIndex } from './core.js';
import { recomputeAffinityFor } from './affinity.js';

type Transaction = Prisma.TransactionClient;
type CreateEntryOptions = { note?: string | null; tags?: string[]; playedAt?: Date };

export class RankingConflictError extends Error {}

async function finalizeSession(tx: Transaction, sessionId: string) {
  const session = await tx.comparisonSession.findUniqueOrThrow({
    where: { id: sessionId }, include: { subjectEntry: { include: { venue: true } }, sport: true },
  });
  const ranked = await tx.entry.findMany({ where: { userId: session.userId, sportId: session.sportId, status: 'RANKED' }, orderBy: { rankPosition: 'asc' } });
  const bands = { LIKED: [] as string[], FINE: [] as string[], DISLIKED: [] as string[] };
  for (const entry of ranked) bands[entry.sentiment].push(entry.id);
  const subjectBand = bands[session.subjectEntry.sentiment];
  const insertAt = resolveInsertIndex(session.lo, session.hi, session.step, session.maxSteps);
  subjectBand.splice(insertAt, 0, session.subjectEntryId);
  const scores = (Object.keys(bands) as Sentiment[]).flatMap((sentiment) => rescoreBand(sentiment, bands[sentiment]));
  const positions = globalPositions(bands);
  const scoreById = new Map(scores.map((score) => [score.entryId, score.rallyScore]));
  const positionById = new Map(positions.map((position) => [position.entryId, position.rankPosition]));
  await Promise.all(positions.map(({ entryId, rankPosition }) => tx.entry.update({ where: { id: entryId }, data: { rallyScore: scoreById.get(entryId), rankPosition, status: 'RANKED' } })));
  await tx.comparisonSession.update({ where: { id: session.id }, data: { status: 'DONE', completedAt: new Date() } });
  const rallyScore = scoreById.get(session.subjectEntryId) as number;
  const rankPosition = positionById.get(session.subjectEntryId) as number;
  await tx.venueSportRating.upsert({
    where: { venueId_sportId: { venueId: session.subjectEntry.venueId, sportId: session.sportId } },
    create: { venueId: session.subjectEntry.venueId, sportId: session.sportId, avgRallyScore: rallyScore, nEntries: 1 },
    update: { avgRallyScore: rallyScore, nEntries: { increment: 1 } },
  });
  await tx.activity.create({ data: { actorId: session.userId, type: 'RANKED_VENUE', venueId: session.subjectEntry.venueId, sportId: session.sportId, entryId: session.subjectEntryId, payload: { rallyScore, rankPosition, totalRanked: positions.length } } });
  const wins = await tx.comparison.findMany({
    where: { sessionId: session.id, winnerEntryId: session.subjectEntryId },
    include: { opponentEntry: { include: { venue: true } } }, take: 3,
  });
  const beat = wins.map(({ opponentEntry }) => ({
    id: opponentEntry.venue.id, slug: opponentEntry.venue.slug, name: opponentEntry.venue.name,
    neighborhood: opponentEntry.venue.neighborhood, city: opponentEntry.venue.city, photoUrl: opponentEntry.venue.photoUrl,
  }));
  return { entryId: session.subjectEntryId, rallyScore, rankPosition, totalRanked: positions.length, sentiment: session.subjectEntry.sentiment, beat, sportSlug: session.sport.slug };
}

export async function createEntryAndSession(userId: string, venueId: string, sportSlug: SportSlug, sentiment: Sentiment, options: CreateEntryOptions = {}) {
  return prisma.$transaction(async (tx) => {
    const sport = await tx.sport.findUniqueOrThrow({ where: { slug: sportSlug } });
    const entry = await tx.entry.upsert({
      where: { userId_venueId_sportId: { userId, venueId, sportId: sport.id } },
      create: { userId, venueId, sportId: sport.id, sentiment, status: 'RANKING', note: options.note, tags: options.tags ?? [], playedAt: options.playedAt ?? new Date() },
      update: { sentiment, status: 'RANKING', rallyScore: null, rankPosition: null, note: options.note, tags: options.tags ?? [], playedAt: options.playedAt ?? new Date() },
    });
    const band = await tx.entry.findMany({ where: { userId, sportId: sport.id, sentiment, status: 'RANKED', id: { not: entry.id } }, orderBy: { rankPosition: 'asc' } });
    const session = await tx.comparisonSession.create({ data: { userId, sportId: sport.id, subjectEntryId: entry.id, lo: 0, hi: band.length, maxSteps: maxSteps(band.length) } });
    if (session.maxSteps === 0) await finalizeSession(tx, session.id);
    return { entry, session: await tx.comparisonSession.findUniqueOrThrow({ where: { id: session.id } }) };
  });
}

export async function submitComparison(userId: string, sessionId: string, winnerEntryId: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.comparisonSession.findFirst({ where: { id: sessionId, userId, status: 'ACTIVE' }, include: { subjectEntry: true } });
    if (!session) throw new RankingConflictError('Session is not active or is not owned by this user.');
    const band = await tx.entry.findMany({ where: { userId, sportId: session.sportId, sentiment: session.subjectEntry.sentiment, status: 'RANKED', id: { not: session.subjectEntryId } }, orderBy: { rankPosition: 'asc' }, include: { venue: true } });
    const mid = nextComparisonIndex(session.lo, session.hi);
    if (mid === null || !band[mid]) return { result: await finalizeSession(tx, session.id) };
    const opponent = band[mid];
    await tx.comparison.create({ data: { sessionId, userId, sportId: session.sportId, subjectEntryId: session.subjectEntryId, opponentEntryId: opponent.id, winnerEntryId, positionIndex: mid } });
    if (winnerEntryId !== null) {
      const subjectRating = await tx.venueSportRating.upsert({ where: { venueId_sportId: { venueId: session.subjectEntry.venueId, sportId: session.sportId } }, create: { venueId: session.subjectEntry.venueId, sportId: session.sportId }, update: {} });
      const opponentRating = await tx.venueSportRating.upsert({ where: { venueId_sportId: { venueId: opponent.venueId, sportId: session.sportId } }, create: { venueId: opponent.venueId, sportId: session.sportId }, update: {} });
      const ratings = eloUpdate(Number(subjectRating.elo), Number(opponentRating.elo), subjectRating.nComparisons, opponentRating.nComparisons, winnerEntryId === session.subjectEntryId);
      await Promise.all([tx.venueSportRating.update({ where: { venueId_sportId: { venueId: session.subjectEntry.venueId, sportId: session.sportId } }, data: { elo: ratings.ra, nComparisons: { increment: 1 } } }), tx.venueSportRating.update({ where: { venueId_sportId: { venueId: opponent.venueId, sportId: session.sportId } }, data: { elo: ratings.rb, nComparisons: { increment: 1 } } })]);
    }
    const bounds = applyComparisonResult(session.lo, session.hi, mid, winnerEntryId === session.subjectEntryId);
    const step = session.step + 1;
    await tx.comparisonSession.update({ where: { id: sessionId }, data: { ...bounds, step } });
    if (bounds.lo < bounds.hi && step < session.maxSteps) return { nextPair: { opponentEntryId: opponent.id, opponent: opponent.venue } };
    return { result: await finalizeSession(tx, sessionId) };
  });
  if ('result' in result && result.result !== undefined) await recomputeAffinityFor(userId, result.result.sportSlug);
  return result;
}

export async function abandonSession(userId: string, sessionId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.comparisonSession.findFirst({ where: { id: sessionId, userId, status: 'ACTIVE' } });
    if (!session) throw new RankingConflictError('Session is not active or is not owned by this user.');
    return finalizeSession(tx, session.id);
  });
  await recomputeAffinityFor(userId, result.sportSlug);
  return result;
}

export async function getUserList(userId: string, sportSlug: SportSlug) {
  const sport = await prisma.sport.findUniqueOrThrow({ where: { slug: sportSlug } });
  const entries = await prisma.entry.findMany({ where: { userId, sportId: sport.id, status: 'RANKED' }, orderBy: { rankPosition: 'asc' }, include: { venue: true } });
  return { entries, bandCounts: { LIKED: entries.filter((entry) => entry.sentiment === 'LIKED').length, FINE: entries.filter((entry) => entry.sentiment === 'FINE').length, DISLIKED: entries.filter((entry) => entry.sentiment === 'DISLIKED').length } };
}

export async function deleteEntry(userId: string, entryId: string) {
  const entry = await prisma.entry.findFirstOrThrow({ where: { id: entryId, userId } });
  await prisma.entry.delete({ where: { id: entry.id } });
  return getUserList(userId, (await prisma.sport.findUniqueOrThrow({ where: { id: entry.sportId } })).slug);
}
