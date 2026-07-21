-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "SportSlug" AS ENUM ('basketball', 'pickleball', 'tennis', 'soccer', 'volleyball', 'baseball', 'softball', 'running_track', 'golf_range', 'skate', 'football', 'handball');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('LIKED', 'FINE', 'DISLIKED');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ANY');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('PICKUP', 'CASUAL', 'COMPETITIVE', 'DRILLS', 'LEAGUE', 'SOLO');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('HARDWOOD', 'ASPHALT', 'CONCRETE', 'CLAY', 'GRASS', 'TURF', 'RUBBER', 'SAND', 'OTHER');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('RANKING', 'RANKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RANKED_VENUE', 'CHECKED_IN', 'WANT_TO_TRY', 'FOLLOWED', 'REVIEWED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "home_city" TEXT NOT NULL DEFAULT 'Chicago',
    "home_lat" DOUBLE PRECISION,
    "home_lng" DOUBLE PRECISION,
    "home_geom" geography(Point,4326),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "skill_level" "SkillLevel" NOT NULL,
    "preferred_game_types" "GameType"[],
    "is_primary" BOOLEAN NOT NULL,

    CONSTRAINT "user_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "slug" "SportSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "icon_key" TEXT NOT NULL,
    "default_is_outdoor" BOOLEAN NOT NULL,
    "color_hex" TEXT NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "osm_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Chicago',
    "state" TEXT NOT NULL DEFAULT 'IL',
    "country" TEXT NOT NULL DEFAULT 'US',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "geom" geography(Point,4326),
    "is_indoor" BOOLEAN NOT NULL DEFAULT false,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "requires_reservation" BOOLEAN NOT NULL DEFAULT false,
    "has_lights" BOOLEAN NOT NULL DEFAULT false,
    "has_parking" BOOLEAN NOT NULL DEFAULT false,
    "has_restrooms" BOOLEAN NOT NULL DEFAULT false,
    "has_water" BOOLEAN NOT NULL DEFAULT false,
    "photo_url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'osm',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sports" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "court_count" INTEGER NOT NULL DEFAULT 1,
    "surface" "Surface",
    "condition_score" INTEGER,
    "condition_notes" TEXT,
    "is_lit" BOOLEAN,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "rally_score" DECIMAL(3,1),
    "rank_position" INTEGER,
    "status" "EntryStatus" NOT NULL DEFAULT 'RANKING',
    "note" TEXT,
    "tags" TEXT[],
    "played_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "subject_entry_id" UUID NOT NULL,
    "lo" INTEGER NOT NULL,
    "hi" INTEGER NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "max_steps" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "comparison_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparisons" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "subject_entry_id" UUID NOT NULL,
    "opponent_entry_id" UUID NOT NULL,
    "winner_entry_id" UUID,
    "position_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sport_ratings" (
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "elo" DECIMAL(7,2) NOT NULL DEFAULT 1500,
    "n_comparisons" INTEGER NOT NULL DEFAULT 0,
    "avg_rally_score" DECIMAL(3,1),
    "n_entries" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_sport_ratings_pkey" PRIMARY KEY ("venue_id","sport_id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "headcount" INTEGER NOT NULL,
    "game_type" "GameType" NOT NULL,
    "skill_level" "SkillLevel" NOT NULL,
    "note" TEXT,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "photos" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "followee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateTable
CREATE TABLE "want_to_try" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "want_to_try_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_affinities" (
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "tau" DECIMAL(4,3) NOT NULL,
    "overlap_n" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taste_affinities_pkey" PRIMARY KEY ("user_a_id","user_b_id","sport_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "venue_id" UUID,
    "sport_id" UUID,
    "entry_id" UUID,
    "check_in_id" UUID,
    "target_user_id" UUID,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_cache" (
    "id" UUID NOT NULL,
    "geohash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "user_sports_user_id_sport_id_key" ON "user_sports"("user_id", "sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "venues_osm_id_key" ON "venues"("osm_id");

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE INDEX "venues_lat_lng_idx" ON "venues"("lat", "lng");

-- CreateIndex
CREATE INDEX "venue_sports_sport_id_idx" ON "venue_sports"("sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_sports_venue_id_sport_id_key" ON "venue_sports"("venue_id", "sport_id");

-- CreateIndex
CREATE INDEX "entries_user_id_sport_id_rank_position_idx" ON "entries"("user_id", "sport_id", "rank_position");

-- CreateIndex
CREATE INDEX "entries_venue_id_sport_id_idx" ON "entries"("venue_id", "sport_id");

-- CreateIndex
CREATE INDEX "entries_user_id_sport_id_status_idx" ON "entries"("user_id", "sport_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entries_user_id_venue_id_sport_id_key" ON "entries"("user_id", "venue_id", "sport_id");

-- CreateIndex
CREATE INDEX "comparisons_user_id_sport_id_created_at_idx" ON "comparisons"("user_id", "sport_id", "created_at");

-- CreateIndex
CREATE INDEX "comparisons_subject_entry_id_idx" ON "comparisons"("subject_entry_id");

-- CreateIndex
CREATE INDEX "venue_sport_ratings_sport_id_elo_idx" ON "venue_sport_ratings"("sport_id", "elo" DESC);

-- CreateIndex
CREATE INDEX "check_ins_venue_id_sport_id_expires_at_idx" ON "check_ins"("venue_id", "sport_id", "expires_at" DESC);

-- CreateIndex
CREATE INDEX "check_ins_user_id_started_at_idx" ON "check_ins"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "reviews_venue_id_created_at_idx" ON "reviews"("venue_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "follows_followee_id_idx" ON "follows"("followee_id");

-- CreateIndex
CREATE UNIQUE INDEX "want_to_try_user_id_venue_id_sport_id_key" ON "want_to_try"("user_id", "venue_id", "sport_id");

-- CreateIndex
CREATE INDEX "activities_actor_id_created_at_idx" ON "activities"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weather_cache_geohash_key" ON "weather_cache"("geohash");

-- AddForeignKey
ALTER TABLE "user_sports" ADD CONSTRAINT "user_sports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sports" ADD CONSTRAINT "user_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sports" ADD CONSTRAINT "venue_sports_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sports" ADD CONSTRAINT "venue_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_sessions" ADD CONSTRAINT "comparison_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_sessions" ADD CONSTRAINT "comparison_sessions_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_sessions" ADD CONSTRAINT "comparison_sessions_subject_entry_id_fkey" FOREIGN KEY ("subject_entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "comparison_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_subject_entry_id_fkey" FOREIGN KEY ("subject_entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_opponent_entry_id_fkey" FOREIGN KEY ("opponent_entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_winner_entry_id_fkey" FOREIGN KEY ("winner_entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_ratings" ADD CONSTRAINT "venue_sport_ratings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_ratings" ADD CONSTRAINT "venue_sport_ratings_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_to_try" ADD CONSTRAINT "want_to_try_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_to_try" ADD CONSTRAINT "want_to_try_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_to_try" ADD CONSTRAINT "want_to_try_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_affinities" ADD CONSTRAINT "taste_affinities_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_affinities" ADD CONSTRAINT "taste_affinities_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_affinities" ADD CONSTRAINT "taste_affinities_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
