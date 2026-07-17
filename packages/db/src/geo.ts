import { Prisma } from '@prisma/client';
import { prisma } from './index.js';

export type GeoQueryOptions = {
  city?: string;
};

export type VenueDistance = {
  id: string;
  distanceMeters: number;
};

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
