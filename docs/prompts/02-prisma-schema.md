# Task 2 — Prisma schema & migrations

```text
In packages/db, write the complete Prisma schema for Rally. Postgres provider,
previewFeatures = ["postgresqlExtensions"], extensions = [postgis]. Use @@map to snake_case every table
and @map every field; keep camelCase in the client API.

ENUMS: SportSlug(basketball, pickleball, tennis, soccer, volleyball, baseball, softball, running_track,
golf_range, skate, football, handball), Sentiment(LIKED, FINE, DISLIKED), SkillLevel(BEGINNER,
INTERMEDIATE, ADVANCED, ANY), GameType(PICKUP, CASUAL, COMPETITIVE, DRILLS, LEAGUE, SOLO),
Surface(HARDWOOD, ASPHALT, CONCRETE, CLAY, GRASS, TURF, RUBBER, SAND, OTHER),
EntryStatus(RANKING, RANKED), SessionStatus(ACTIVE, DONE),
ActivityType(RANKED_VENUE, CHECKED_IN, WANT_TO_TRY, FOLLOWED, REVIEWED)

MODELS — implement exactly as specified:

User: id uuid @id (matches Supabase auth.users.id, no default), handle @unique, displayName, avatarUrl?,
  bio?, homeCity @default("Chicago"), homeLat Float?, homeLng Float?,
  homeGeom Unsupported("geography(Point,4326)")?, isDemo Boolean @default(false), createdAt
UserSport: id, userId, sportId, skillLevel, preferredGameTypes GameType[], isPrimary Boolean
  @@unique([userId, sportId])
Sport: id, slug SportSlug @unique, name, iconKey, defaultIsOutdoor Boolean, colorHex
Venue: id, osmId String? @unique, name, slug @unique, address?, neighborhood?, city @default("Chicago"),
  state @default("IL"), country @default("US"), lat Float, lng Float,
  geom Unsupported("geography(Point,4326)")?, isIndoor, isFree, requiresReservation, hasLights,
  hasParking, hasRestrooms, hasWater (all Boolean @default(false)), photoUrl?, source @default("osm"),
  createdById String?, createdAt, updatedAt
  @@index([city]) @@index([lat, lng])
VenueSport: id, venueId, sportId, courtCount Int @default(1), surface Surface?, conditionScore Int?,
  conditionNotes String?, isLit Boolean?, updatedAt  @@unique([venueId, sportId]) @@index([sportId])
Entry: id, userId, venueId, sportId, sentiment, rallyScore Decimal? @db.Decimal(3,1), rankPosition Int?,
  status EntryStatus @default(RANKING), note?, tags String[], playedAt, createdAt, updatedAt
  @@unique([userId, venueId, sportId])
  @@index([userId, sportId, rankPosition]) @@index([venueId, sportId]) @@index([userId, sportId, status])
ComparisonSession: id, userId, sportId, subjectEntryId, lo Int, hi Int, step Int @default(0),
  maxSteps Int, status SessionStatus @default(ACTIVE), createdAt, completedAt?
Comparison: id, sessionId?, userId, sportId, subjectEntryId, opponentEntryId, winnerEntryId? (null = tie),
  positionIndex Int, createdAt   @@index([userId, sportId, createdAt]) @@index([subjectEntryId])
VenueSportRating: venueId, sportId, elo Decimal @db.Decimal(7,2) @default(1500), nComparisons Int
  @default(0), avgRallyScore Decimal? @db.Decimal(3,1), nEntries Int @default(0), updatedAt
  @@id([venueId, sportId]) @@index([sportId, elo(sort: Desc)])
CheckIn: id, userId, venueId, sportId, startedAt @default(now()), expiresAt, endedAt?, headcount Int,
  gameType, skillLevel, note?  @@index([venueId, sportId, expiresAt(sort: Desc)]) @@index([userId, startedAt])
Review: id, userId, venueId, sportId, body, photos String[], createdAt
  @@index([venueId, createdAt(sort: Desc)])
Follow: followerId, followeeId, createdAt  @@id([followerId, followeeId]) @@index([followeeId])
WantToTry: id, userId, venueId, sportId, source?, createdAt  @@unique([userId, venueId, sportId])
TasteAffinity: userAId, userBId, sportId, tau Decimal @db.Decimal(4,3), overlapN Int, computedAt
  @@id([userAId, userBId, sportId])
Activity: id, actorId, type, venueId?, sportId?, entryId?, checkInId?, targetUserId?, payload Json,
  createdAt  @@index([actorId, createdAt(sort: Desc)])
WeatherCache: id, geohash @unique, payload Json, fetchedAt

All relations explicit, with onDelete: Cascade where the child is meaningless without the parent
(Entry->User, VenueSport->Venue, Comparison->Entry). Name back-relations sensibly (User.entries,
Venue.venueSports). The self-relation on Follow needs named relations ("follower"/"followee").

Then:
1. `prisma migrate dev --create-only --name init` and HAND-EDIT the generated SQL to add, at the top:
     CREATE EXTENSION IF NOT EXISTS postgis;
   and at the bottom:
     ALTER TABLE venues ADD COLUMN geom geography(Point,4326);
     CREATE INDEX venues_geom_gix ON venues USING GIST (geom);
     CREATE INDEX checkins_live_idx ON check_ins (venue_id, sport_id, expires_at DESC)
       WHERE ended_at IS NULL;
     ALTER TABLE follows ADD CONSTRAINT follows_no_self CHECK (follower_id <> followee_id);
2. Apply it.
3. packages/db/src/index.ts: export the singleton PrismaClient (globalThis cache) and re-export all
   Prisma types + enums.
4. packages/db/src/geo.ts: exported helpers
   `setVenueGeom(tx, venueId, lat, lng)` — raw UPDATE with ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
     (NOTE: lng FIRST — this is the most common PostGIS bug; add a comment saying so), and
   `venuesWithinRadius(lat, lng, radiusMeters, opts)` — ST_DWithin + ST_Distance, ordered by distance,
     LIMIT 200, returning { id, distanceMeters }[]. Fully typed, no `any`.

Do NOT write a seed script yet.
Verify: `pnpm --filter db exec prisma migrate dev` succeeds, `prisma studio` opens,
and `SELECT PostGIS_Version();` works.
```

**Verify:** studio shows all tables; `\di venues_geom_gix` exists.
**Commit:** `feat(db): prisma schema + postgis migration`
