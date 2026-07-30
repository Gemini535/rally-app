-- PostGIS + integrity objects that Prisma's schema can't express (the hand-edited tail from Task 2).
-- The `geom`/`home_geom` geography columns and the postgis extension already exist from the init
-- migration; this adds the indexes and the self-follow guard that were never applied.

-- GIST index backing ST_DWithin/ST_Distance radius searches over venues.geom.
CREATE INDEX IF NOT EXISTS "venues_geom_gix" ON "venues" USING GIST ("geom");

-- Partial index matching the live check-in access pattern (active = ended_at IS NULL).
CREATE INDEX IF NOT EXISTS "checkins_live_idx"
  ON "check_ins" ("venue_id", "sport_id", "expires_at" DESC)
  WHERE "ended_at" IS NULL;

-- A follow can never point at yourself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_no_self') THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_no_self" CHECK ("follower_id" <> "followee_id");
  END IF;
END $$;
