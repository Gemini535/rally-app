import { prisma } from '@rally/db';
import type { SportSlug } from '@rally/shared';
import { kendallTau, tasteAffinity } from './core.js';

export async function recomputeAffinityFor(userId: string, sportSlug: SportSlug): Promise<void> {
  const sport = await prisma.sport.findUnique({ where: { slug: sportSlug } });
  if (!sport) return;
  const follows = await prisma.follow.findMany({
    where: { OR: [{ followerId: userId }, { followeeId: userId }] },
    select: { followerId: true, followeeId: true },
  });
  const peers = new Set(follows.map((follow) => follow.followerId === userId ? follow.followeeId : follow.followerId));
  const mine = await prisma.entry.findMany({ where: { userId, sportId: sport.id, status: 'RANKED' }, select: { venueId: true, rankPosition: true } });
  const mineByVenue = new Map(mine.filter((entry) => entry.rankPosition !== null).map((entry) => [entry.venueId, entry.rankPosition as number]));

  await Promise.all([...peers].map(async (peerId) => {
    const theirs = await prisma.entry.findMany({ where: { userId: peerId, sportId: sport.id, status: 'RANKED', venueId: { in: [...mineByVenue.keys()] } }, select: { venueId: true, rankPosition: true } });
    const overlap = theirs.filter((entry) => entry.rankPosition !== null && mineByVenue.has(entry.venueId));
    if (overlap.length < 3) return;
    const ranksA = overlap.map((entry) => mineByVenue.get(entry.venueId) as number);
    const ranksB = overlap.map((entry) => entry.rankPosition as number);
    const tau = kendallTau(ranksA, ranksB);
    await Promise.all([[userId, peerId], [peerId, userId]].map(([userAId, userBId]) => prisma.tasteAffinity.upsert({
      where: { userAId_userBId_sportId: { userAId, userBId, sportId: sport.id } },
      create: { userAId, userBId, sportId: sport.id, tau, overlapN: overlap.length },
      update: { tau, overlapN: overlap.length, computedAt: new Date() },
    })));
  }));
}

export { tasteAffinity };
