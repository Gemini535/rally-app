import { prisma, setUserHomeGeom, type Prisma } from '@rally/db';
import { UpdateMeBody } from '@rally/shared';
import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, conflict, notFound } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import type {} from '../types/express.js';

const meRouter: RouterType = Router();

type ProfileUser = Prisma.UserGetPayload<{ include: { userSports: { include: { sport: true } }; followerFollows: true; followeeFollows: true } }>;

function toProfile(user: ProfileUser) {
  return {
    id: user.id, handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio,
    homeCity: user.homeCity, homeLat: user.homeLat, homeLng: user.homeLng, isDemo: user.isDemo, createdAt: user.createdAt.toISOString(),
    sports: user.userSports.map(({ sport, skillLevel, isPrimary }) => ({ slug: sport.slug, name: sport.name, skillLevel, isPrimary })),
    followerCount: user.followeeFollows.length, followingCount: user.followerFollows.length, isFollowing: false,
  };
}

meRouter.get('/', requireAuth, asyncHandler(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.user!.id }, include: { userSports: { include: { sport: true } }, followerFollows: true, followeeFollows: true } });
  if (!user) throw notFound('Complete signup to create your Rally profile.');
  response.json({ user: toProfile(user) });
}));

meRouter.post('/', requireAuth, validate({ body: UpdateMeBody.pick({ handle: true, displayName: true }) }), asyncHandler(async (request, response) => {
  const body = request.body as { handle: string; displayName: string };
  try {
    // No Postgres trigger is needed: signup explicitly creates the public User row from the auth uid.
    const user = await prisma.user.create({ data: { id: request.user!.id, handle: body.handle, displayName: body.displayName }, include: { userSports: { include: { sport: true } }, followerFollows: true, followeeFollows: true } });
    response.status(201).json({ user: toProfile(user) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw conflict('That handle is already taken.');
    throw error;
  }
}));

meRouter.patch('/', requireAuth, validate({ body: UpdateMeBody }), asyncHandler(async (request, response) => {
  const body = request.body as typeof UpdateMeBody._output;
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: request.user!.id }, data: { handle: body.handle, displayName: body.displayName, avatarUrl: body.avatarUrl, bio: body.bio, homeCity: body.homeCity, homeLat: body.homeLat, homeLng: body.homeLng } });
    if (body.homeLat !== null && body.homeLat !== undefined && body.homeLng !== null && body.homeLng !== undefined) await setUserHomeGeom(tx, updated.id, body.homeLat, body.homeLng);
    if (body.sports) {
      await Promise.all(body.sports.map(async ({ sportSlug, skillLevel, preferredGameTypes, isPrimary }) => {
        const sport = await tx.sport.findUniqueOrThrow({ where: { slug: sportSlug } });
        return tx.userSport.upsert({ where: { userId_sportId: { userId: updated.id, sportId: sport.id } }, create: { userId: updated.id, sportId: sport.id, skillLevel, preferredGameTypes, isPrimary }, update: { skillLevel, preferredGameTypes, isPrimary } });
      }));
    }
    return tx.user.findUniqueOrThrow({ where: { id: updated.id }, include: { userSports: { include: { sport: true } }, followerFollows: true, followeeFollows: true } });
  });
  response.json({ user: toProfile(user) });
}));

export default meRouter;
