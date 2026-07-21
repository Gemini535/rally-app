import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

for (const line of readFileSync('../../.env', 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const enabled = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_JWT_SECRET);
const suite = enabled ? describe : describe.skip;

suite('ranking HTTP integration', () => {
  let server: ReturnType<typeof createServer>;
  let origin = '';
  let userId = ''; let sportId = ''; let firstVenueId = ''; let secondVenueId = '';
  const secret = process.env.SUPABASE_JWT_SECRET as string;

  beforeAll(async () => {
    const { default: app } = await import('../app.js');
    const { prisma } = await import('@rally/db');
    userId = randomUUID(); const suffix = randomUUID().slice(0, 8);
    const sport = await prisma.sport.upsert({ where: { slug: 'basketball' }, create: { slug: 'basketball', name: 'Basketball', iconKey: 'circle', colorHex: '#f97316', defaultIsOutdoor: true }, update: {} }); sportId = sport.id;
    const one = await prisma.venue.create({ data: { name: `Integration One ${suffix}`, slug: `integration-one-${suffix}`, lat: 41.88, lng: -87.63 } });
    const two = await prisma.venue.create({ data: { name: `Integration Two ${suffix}`, slug: `integration-two-${suffix}`, lat: 41.89, lng: -87.64 } }); firstVenueId = one.id; secondVenueId = two.id;
    await prisma.user.create({ data: { id: userId, handle: `integration_${suffix}`, displayName: 'Integration Tester' } });
    await prisma.venueSport.createMany({ data: [{ venueId: one.id, sportId }, { venueId: two.id, sportId }] });
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test server address.'); origin = `http://127.0.0.1:${address.port}`;
  }, 30_000);
  afterAll(async () => { const { prisma } = await import('@rally/db'); await new Promise<void>((resolve) => server.close(() => resolve())); await prisma.user.delete({ where: { id: userId } }).catch(() => undefined); await prisma.venue.deleteMany({ where: { id: { in: [firstVenueId, secondVenueId] } } }); await prisma.$disconnect(); });

  test('POST /entries then comparisons ranks the subject and moves both Elo rows', async () => {
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${jwt.sign({ sub: userId, email: 'integration@rally.test' }, secret, { algorithm: 'HS256' })}` };
    const post = (path: string, body: unknown) => fetch(`${origin}/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const first = await post('/entries', { venueId: firstVenueId, sportSlug: 'basketball', sentiment: 'LIKED', playedAt: new Date().toISOString(), tags: [] }); expect(first.status).toBe(201);
    const second = await post('/entries', { venueId: secondVenueId, sportSlug: 'basketball', sentiment: 'LIKED', playedAt: new Date().toISOString(), tags: [] }); expect(second.status).toBe(201);
    const secondPayload = await second.json() as { entry: { id: string }; session: { id: string } };
    const comparison = await post('/comparisons', { sessionId: secondPayload.session.id, winnerEntryId: secondPayload.entry.id }); expect(comparison.status).toBe(200);
    const { prisma } = await import('@rally/db'); const entries = await prisma.entry.findMany({ where: { userId, sportId }, orderBy: { rankPosition: 'asc' } });
    expect(entries.map((entry) => entry.rankPosition)).toEqual([1, 2]); expect(entries[0].id).toBe(secondPayload.entry.id); expect(Number(entries[0].rallyScore)).toBe(10); expect(Number(entries[1].rallyScore)).toBe(6.7);
    const ratings = await prisma.venueSportRating.findMany({ where: { venueId: { in: [firstVenueId, secondVenueId] }, sportId } }); expect(ratings).toHaveLength(2); expect(ratings.every((rating) => rating.nComparisons === 1 && Number(rating.elo) !== 1500)).toBe(true);
  }, 30_000);
});
