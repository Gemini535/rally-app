import { Prisma } from '@prisma/client';
import { prisma } from './index.js';

export type GeoQueryOptions = {
  city?: string;
};

export type VenueDistance = {
  id: string;
  distanceMeters: number;
};

export type VenueSearchOptions = { lat?: number; lng?: number; radiusMeters?: number; sportSlugs?: string[]; isIndoor?: boolean; isFree?: boolean; hasLights?: boolean; q?: string; city?: string; limit?: number };

export async function searchVenues(options: VenueSearchOptions): Promise<VenueDistance[]> {
  const limit = Math.min(options.limit ?? 20, 200);
  const city = options.city ?? 'Chicago';
  const sportFilter = options.sportSlugs?.length ? Prisma.sql`AND EXISTS (SELECT 1 FROM venue_sports vs JOIN sports s ON s.id = vs.sport_id WHERE vs.venue_id = v.id AND s.slug::text = ANY(ARRAY[${Prisma.join(options.sportSlugs)}]))` : Prisma.empty;
  const flags = Prisma.join([options.isIndoor === undefined ? Prisma.empty : Prisma.sql`AND v.is_indoor = ${options.isIndoor}`, options.isFree === undefined ? Prisma.empty : Prisma.sql`AND v.is_free = ${options.isFree}`, options.hasLights === undefined ? Prisma.empty : Prisma.sql`AND v.has_lights = ${options.hasLights}`, options.q ? Prisma.sql`AND (v.name ILIKE ${`%${options.q}%`} OR v.neighborhood ILIKE ${`%${options.q}%`})` : Prisma.empty], ' ');
  if (options.lat !== undefined && options.lng !== undefined) return prisma.$queryRaw<VenueDistance[]>(Prisma.sql`WITH origin AS (SELECT ST_SetSRID(ST_MakePoint(${options.lng}, ${options.lat}),4326)::geography geom) SELECT v.id, ST_Distance(v.geom,origin.geom)::float8 AS "distanceMeters" FROM venues v CROSS JOIN origin WHERE v.geom IS NOT NULL AND ST_DWithin(v.geom,origin.geom,${options.radiusMeters ?? 5000}) AND v.city=${city} ${sportFilter} ${flags} ORDER BY "distanceMeters" LIMIT ${limit}`);
  return prisma.$queryRaw<VenueDistance[]>(Prisma.sql`SELECT v.id, NULL::float8 AS "distanceMeters" FROM venues v WHERE v.city=${city} ${sportFilter} ${flags} ORDER BY v.name LIMIT ${limit}`);
}

export async function setVenueGeom(
  tx: Prisma.TransactionClient,
  venueId: string,
  lat: number,
  lng: number,
): Promise<void> {
  // PostGIS points are longitude first, then latitude; reversing them is a common geo bug.
  await tx.$executeRaw`
    UPDATE venues
    SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE id = ${venueId}::uuid
  `;
}

export async function setUserHomeGeom(
  tx: Prisma.TransactionClient,
  userId: string,
  lat: number,
  lng: number,
): Promise<void> {
  // PostGIS points are longitude first, then latitude; reversing them is a common geo bug.
  await tx.$executeRaw`
    UPDATE users
    SET home_geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE id = ${userId}::uuid
  `;
}

export async function venuesWithinRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  opts: GeoQueryOptions = {},
): Promise<VenueDistance[]> {
  const cityFilter = opts.city ? Prisma.sql`AND v.city = ${opts.city}` : Prisma.empty;

  return prisma.$queryRaw<VenueDistance[]>(Prisma.sql`
    WITH origin AS (
      SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS geom
    )
    SELECT v.id, ST_Distance(v.geom, origin.geom)::float8 AS "distanceMeters"
    FROM venues v
    CROSS JOIN origin
    WHERE ST_DWithin(v.geom, origin.geom, ${radiusMeters})
      ${cityFilter}
    ORDER BY "distanceMeters" ASC
    LIMIT 200
  `);
}
