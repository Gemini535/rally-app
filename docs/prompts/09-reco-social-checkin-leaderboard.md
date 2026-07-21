# Task 9 — Reco, ranking, social, check-in, leaderboard routes

```text
Implement the remaining API routes, wiring to the services from Tasks 4 and 8.

FIRST — fix these contract mismatches in packages/shared before writing any route. The committed
schemas contradict this task and Tasks 11 and 13. Skip this and the frontend breaks at merge point 2.
  - FeedQuery is currently { cursor, limit }, but Task 11 calls
    /api/feed/recommended?lat&lng&sport&radius&playableNow. Add lat, lng (z.coerce.number, required),
    sportSlug (SportSlugSchema), radiusMeters (default 5000, max 50000), playableNow
    (OptionalBooleanSchema). Keep cursor/limit.
  - SubmitComparisonBody is currently { opponentEntryId, winnerEntryId }, but this task and Task 13
    both send { sessionId, winnerEntryId }. Add sessionId: z.string().uuid(). Keep opponentEntryId
    only if the service genuinely needs it — otherwise drop it so the client contract is unambiguous.
  - LeaderboardQuery uses friendsOnly: boolean; this task specifies scope=global|friends. Pick ONE
    and make the route, the schema, and Task 14's ScopeToggle agree. Recommend keeping friendsOnly.
  - There is no UpdateEntryBody and no PATCH /api/entries/:id, but Task 13's DETAILS step PATCHes the
    entry with note + tags after comparisons finish. Add UpdateEntryBody { note?: string | null,
    tags?: string[] } and PATCH /api/entries/:id (requireAuth, owner only) to the route list below.
  - responses.ts has a single FeedResponseSchema but there are two different feeds. Split it into
    FeedRecommendedResponseSchema (VenueCard[] + weights) and FeedSocialResponseSchema (paginated
    Activity). Also add UserProfileResponseSchema and WantToTryResponseSchema — this task returns
    both and neither exists.

LAST — register every new router in apps/api/src/app.ts. It currently mounts only meRouter, and the
catch-all notFound handler sits immediately after it, so any router you forget to mount 404s silently
with no error at build time.

--- services/recommend.ts ---
getRecommendations({ viewerId, lat, lng, sportSlug, radiusMeters, playableNow, limit })
  1. Candidates: geo.searchVenues (max 200), filtered to sportSlug.
  2. Batch-load: the viewer's entries for this sport, followees' entries for these venues, taste
     affinities, ratings, live status (batch), weather (one call per unique 5-char geohash).
  3. Per candidate:
     personal: viewer ranked it -> rallyScore/10.
               else cosine(viewerTasteVector, venueFeatureVector), where the feature vector is the
               fixed 8-dim [isIndoor, isFree, hasLights, hasParking, hasRestrooms, requiresReservation,
               surfaceBucket01, min(courtCount,8)/8] and the viewer's taste vector is the
               rallyScore-weighted mean of their ranked venues' feature vectors.
               Viewer has < 2 entries in this sport -> personal = min-max normalized shrunkElo over
               the candidate set.
     social:   Σ(affinity_f * score_f/10) / Σ(affinity_f) over followees who ranked it; none -> null
     proximity: exp(-distanceKm / RECO_PROXIMITY_D0_KM)
     live:     no active check-ins -> null (unknown, NOT bad);
               else recency * crowdFit * skillMatch * typeMatch
               (recency = exp(-minutesSinceLatest/45); crowdFit = gaussian around IDEAL_COUNT[sport]
                with sigma = ideal/2; skillMatch 1.0 on match or ANY else 0.5; typeMatch 1.0 if any
                active check-in's gameType is in the viewer's preferredGameTypes else 0.7)
     gate:     playabilityGate(...).multiplier
  4. Blend: weights from env (RECO_W_*), DROP null signals, renormalize the remaining weights
     proportionally, base = Σ w_k*signal_k, rallyScore = 10 * base * gate.
  5. playableNow=true -> filter out live === null and gate < 0.5.
  6. Build `why: string[]` — up to 3 human strings, most-distinctive signal first, e.g.
     "7 here now · competitive", "Dev and 1 other rank this top-3", "1.2 mi away",
     "Matches your taste in indoor courts". Include gateReason as a why when gate < 1.
  7. Sort by rallyScore desc, return `limit`, include the resolved weights in the response.
Every component value must be returned in reco.components so the UI can explain itself.

--- routes/entries.ts + routes/comparisons.ts ---
POST   /api/entries                          requireAuth -> { entry, session }
GET    /api/comparisons/session/:id          requireAuth -> ComparisonSession (403 if not owner)
POST   /api/comparisons                      requireAuth, body { sessionId, winnerEntryId: string|null }
                                             -> ComparisonSession with nextPair OR result
POST   /api/comparisons/session/:id/abandon  requireAuth
GET    /api/me/list?sport=                   requireAuth -> { sport, entries, counts }
GET    /api/users/:handle/list?sport=        optionalAuth
DELETE /api/entries/:id                      requireAuth -> 204

--- routes/checkins.ts ---
POST  /api/check-ins         requireAuth. Auto-end any active check-in for this user first.
                             expiresAt = now + CHECK_IN_TTL_MINUTES. Write an Activity (CHECKED_IN).
PATCH /api/check-ins/:id     requireAuth, owner only
POST  /api/check-ins/:id/end requireAuth, owner only
GET   /api/check-ins/active  requireAuth -> CheckIn | null
GET   /api/check-ins/nearby  optionalAuth -> LiveStatus[]

--- routes/social.ts ---
POST   /api/follows         requireAuth (409 on self-follow, idempotent on duplicate). Writes an
                            Activity (FOLLOWED) and triggers recomputeAffinityFor.
DELETE /api/follows/:userId requireAuth -> 204
GET    /api/users/:handle   optionalAuth -> UserProfile (with tasteAffinity vs. the caller)
GET    /api/users/:handle/followers | /following -> paginated UserMini
GET    /api/users/search?q= -> UserMini[] (ILIKE on handle + displayName, limit 10)
GET    /api/feed/social     requireAuth -> paginated Activity, cursor = createdAt.
                            WHERE actorId IN (followees) OR actorId = me, ORDER BY createdAt DESC.
                            Batch-hydrate actor + venue. Exclude CHECKED_IN rows whose check-in has
                            expired AND is older than 24h (dead liveness is noise).

--- routes/wantToTry.ts ---
POST /api/want-to-try, DELETE /api/want-to-try/:venueId?sport=, GET /api/me/want-to-try

--- routes/feed.ts ---
GET /api/feed/recommended  requireAuth, validate(FeedQuery) -> { items: VenueCard[], weights }

--- routes/leaderboard.ts ---
GET /api/leaderboard?city&sport&scope=global|friends&limit
  - global: VenueSportRating for the sport ordered by shrunkElo desc, tiebreak nEntries desc, name asc.
    Compute shrunkElo in SQL: 1500 + (elo - 1500) * n_comparisons / (n_comparisons + 8).
  - friends: recompute the aggregate over entries by the caller's followees + self only
    (avg rallyScore desc, min 2 entries to appear).
  - `movement`: null for now (keep the field; add a 7-day-delta TODO comment).

Add vitest integration tests for the full loop: POST /entries -> N x POST /comparisons -> assert the
final rankPosition and rallyScore, and assert both VenueSportRating rows moved.

Verify: run the full flow with curl against seeded data and paste the output. Show
/api/feed/recommended returning populated `why` strings and non-null components.
```

**Verify:** the `why` strings read like a product, not a debug dump.
**Commit:** `feat(api): reco engine, comparisons, social, checkins, leaderboard`
🔀 **MERGE POINT 2 — the API is real.** Person B flips `NEXT_PUBLIC_USE_MOCKS=false`. Budget 2 hours for this; it will not be zero.
