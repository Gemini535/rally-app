import { prisma } from '@rally/db';
import { CreateEntryBody, SportSlugSchema, SubmitComparisonBody, UpdateEntryBody, type SportSlug } from '@rally/shared';
import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { asyncHandler, forbidden, notFound } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { abandonSession, createEntryAndSession, deleteEntry, getUserList, submitComparison } from '../services/ranking/service.js';

const rankingRouter: RouterType = Router();
const SportQuery = { query: z.object({ sport: SportSlugSchema }) };
const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const listResponse = (list: Awaited<ReturnType<typeof getUserList>>) => ({
  entries: list.entries.map((entry) => ({
    id: entry.id, sentiment: entry.sentiment, rallyScore: entry.rallyScore === null ? null : Number(entry.rallyScore), rankPosition: entry.rankPosition,
    venue: { id: entry.venue.id, slug: entry.venue.slug, name: entry.venue.name, neighborhood: entry.venue.neighborhood, city: entry.venue.city, photoUrl: entry.venue.photoUrl },
  })),
  bandCounts: list.bandCounts,
});

rankingRouter.post('/entries', requireAuth, validate({ body: CreateEntryBody }), asyncHandler(async (request, response) => {
  const body = request.body as typeof CreateEntryBody._output;
  const result = await createEntryAndSession(request.user!.id, body.venueId, body.sportSlug, body.sentiment, { note: body.note, tags: body.tags, playedAt: new Date(body.playedAt) });
  response.status(201).json(result);
}));

rankingRouter.get('/comparisons/session/:id', requireAuth, asyncHandler(async (request, response) => {
  const session = await prisma.comparisonSession.findUnique({ where: { id: routeParam(request.params.id) }, include: { subjectEntry: { include: { venue: true } }, sport: true } });
  if (!session) throw notFound('Comparison session not found.');
  if (session.userId !== request.user!.id) throw forbidden();
  response.json({ session });
}));

rankingRouter.post('/comparisons', requireAuth, validate({ body: SubmitComparisonBody }), asyncHandler(async (request, response) => {
  const { sessionId, winnerEntryId } = request.body as typeof SubmitComparisonBody._output;
  response.json(await submitComparison(request.user!.id, sessionId, winnerEntryId));
}));

rankingRouter.post('/comparisons/session/:id/abandon', requireAuth, asyncHandler(async (request, response) => {
  response.json({ result: await abandonSession(request.user!.id, routeParam(request.params.id)) });
}));

rankingRouter.get('/me/list', requireAuth, validate(SportQuery), asyncHandler(async (request, response) => {
  response.json(listResponse(await getUserList(request.user!.id, request.query.sport as SportSlug)));
}));

rankingRouter.get('/users/:handle/list', optionalAuth, validate(SportQuery), asyncHandler(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { handle: routeParam(request.params.handle) } });
  if (!user) throw notFound('User not found.');
  response.json(listResponse(await getUserList(user.id, request.query.sport as SportSlug)));
}));

rankingRouter.patch('/entries/:id', requireAuth, validate({ body: UpdateEntryBody }), asyncHandler(async (request, response) => {
  const body = request.body as typeof UpdateEntryBody._output;
  const entry = await prisma.entry.findUnique({ where: { id: routeParam(request.params.id) } });
  if (!entry) throw notFound('Entry not found.');
  if (entry.userId !== request.user!.id) throw forbidden();
  const updated = await prisma.entry.update({ where: { id: entry.id }, data: { note: body.note, ...(body.tags === undefined ? {} : { tags: body.tags }) } });
  response.json({ entry: { id: updated.id, note: updated.note, tags: updated.tags } });
}));

rankingRouter.delete('/entries/:id', requireAuth, asyncHandler(async (request, response) => {
  await deleteEntry(request.user!.id, routeParam(request.params.id));
  response.status(204).end();
}));

export default rankingRouter;
