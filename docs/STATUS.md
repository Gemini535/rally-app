# Rally — Implementation Status Audit

Audited: 2026-07-22. Method: static read of the repo against `docs/prompts/01–17`, **plus a runtime pass**
(tests run, API booted, endpoints curled against the live seeded Supabase DB, seed executed). The
per-task sections below are the static findings; the **Runtime verification** section at the top records what
actually ran on 2026-07-22 and reconciles it against the static claims.

---

## Build checkpoints (docs/GOAL.md)

### Checkpoint 1 — Foundation gaps ✅ (awaiting user verification)
- **PostGIS migration tail applied.** New migration `20260722160000_postgis_indexes` (init was the only
  prior migration; none of these existed in the live DB). Adds `venues_geom_gix` (GIST on `venues.geom`),
  `checkins_live_idx` (partial index on `check_ins` where `ended_at IS NULL`), and the `follows_no_self`
  CHECK constraint. Applied via `prisma migrate deploy`. Verified present in the DB; a self-follow INSERT is
  now rejected by `follows_no_self`.
- **`/api/venues` sport filter fixed** ([discovery.ts](../apps/api/src/routes/discovery.ts)) — the route
  previously ignored `sports` entirely. Now filters to venues hosting any requested sport (and also honors
  `q` name/neighborhood search, which was likewise ignored). Verified: `sports=basketball` → 15 items, 0
  violations; `sports=tennis,pickleball` → 30 items, 0 violations; unfiltered still returns all 12 sports.
- **Verify yourself:** see the "Checkpoint 1 verification" commands below.

### Checkpoint 2 — Seed the social graph ✅ (awaiting user verification; canonical reseed running)
Added to [scripts/seed.ts](../scripts/seed.ts): `seedFollows` (~5/user via
`0.6*sportOverlap + 0.4*proximity`; demo accounts forced to ≥6 incl. ≥2 highest list-overlap),
`seedReviews` (~25% of ranked entries, attribute-consistent text — only mentions lights/surface/"packed"
when the venue actually has them), `seedHistoricalCheckIns` (~400 completed check-ins over 14 days,
weekday/weekend hour distribution, Poisson headcount, via `createMany`), `seedWantToTry` (2–4/user,
preferring followees' top-3 venues), plus `FOLLOWED`/`REVIEWED`/`WANT_TO_TRY`/`CHECKED_IN` activity
backfill. `refreshLiveCheckIns` now spreads live check-ins across demos **and their followees** and writes
`CHECKED_IN` activities. `recomputeAffinityFor` now runs after follows exist, so it produces real rows.
`main()` is guarded so the helpers are importable.

**Verified — canonical `pnpm seed:reset` completed clean (exit 0):** `users:18 · venues:180 · entries:180
· comparisons:165 · checkIns:410 · follows:92 · reviews:37 · wantToTry:55 · tasteAffinity:86 ·
activities:374` (374 = 180 ranked + 92 followed + 37 reviewed + 55 want-to-try + 10 checked-in). Against
that fresh DB: `GET /api/feed/social` for marcus → 30 items, **27 from other users, 6 distinct other
actors**; `GET /api/users/rally1/affinity` → real **τ=0.400, overlapN=5**. All social surfaces now have
real data.

### Checkpoint 3 — Wire the orphaned services ✅ (awaiting user verification)
[discovery.ts](../apps/api/src/routes/discovery.ts) rewritten:
- **PostGIS search is now the search path.** `/api/venues` and `/api/feed/recommended` go through
  `geo.ts`'s `searchVenues` (`ST_DWithin` + `ST_Distance`, backed by the `venues_geom_gix` index added in
  Checkpoint 1), then a second Prisma query hydrates relations (the documented two-step — Prisma can't type
  relations off a raw query; distance order is re-applied because `findMany` ignores `IN` order).
  **`Math.hypot` is gone from `apps/api` entirely.**
- **Weather + playability wired into venue detail.** `/api/venues/:id` calls `getWeather(lat,lng)` and
  `playabilityGate(venue, weather, now)`; the response carries a real `weather` object and a real
  `gate`/`gateReason`, and `reco.rallyScore` is multiplied by the gate. `conditionNotes` now comes from the
  venue's `VenueSport` instead of hardcoded `null`.
- **Contract:** added `WeatherSchema` + `weather` to `VenueDetailSchema` in `packages/shared`.

**Verified:**
- Radius genuinely filters: 1000m→9, 3000m→26, 10000m→50 venues; distances geodesic and ascending
  (181m, 451m, 608m…); no lat/lng → `distanceMeters: null`, ordered by name.
- Real weather fetched per location and cached by 5-char geohash (3 distinct geohashes cached; e.g.
  `{tempC:24.6, windKph:8.5, precipProbabilityNext60:0, sunsetAt:"2026-07-23T20:18"}`).
- **All five gate rules fire** (verified by injecting weather into `WeatherCache`): rain 85% → `0.15`
  "Rain likely within the hour"; −5°C → `0.5`; wind 55kph → `0.6`; post-sunset + no lights → `0.1`
  "No lights — sunset was 9:44 AM"; indoor venues short-circuit to `1` in every case, and an outdoor venue
  *with* lights correctly stays `1` after sunset. Score tracks the gate (4.2 → 0.6 under rain).

**Note (not fixed, deploy-only):** `playabilityGate` compares `new Date(weather.sunsetAt)`, and open-meteo
returns a zone-less Chicago wall-clock string. Correct here because the machine runs `America/Chicago`, but
on a UTC host (e.g. a Vercel lambda) the sunset rule would be off by the UTC offset. Deploy is out of scope
per GOAL.md; flagging for whoever does Task 16.

### Checkpoint 4 — The real recommendation engine ✅ (awaiting user verification)
New [services/recommend.ts](../apps/api/src/services/recommend.ts) implements the full plan-§7D blend;
`/api/feed/recommended` now calls it instead of the Elo stub.
- **personal** — ranked venue → `rallyScore/10`; otherwise cosine(viewer taste vector, venue feature
  vector) over the fixed 8-dim `[isIndoor, isFree, hasLights, hasParking, hasRestrooms,
  requiresReservation, surfaceBucket01, min(courtCount,8)/8]`, where the taste vector is the
  rallyScore-weighted mean of the viewer's ranked venues. <2 entries → min-max normalized `shrunkElo`
  across the candidate set. Unknown surface is neutral (0.5), never "worst".
- **social** — `Σ(affinity·score/10) / Σ(affinity)` over followees who ranked it, affinity from
  `TasteAffinity` via `tasteAffinity(tau, overlapN)`; no followee ranked it → `null`.
- **proximity** — `exp(-km / RECO_PROXIMITY_D0_KM)`. **live** — `null` when nobody is checked in (unknown,
  not bad); else `recency · crowdFit · skillMatch · typeMatch`. **gate** — `playabilityGate`.
- **Blend** — env `RECO_W_*` weights, null signals dropped and remaining weights renormalized,
  `rallyScore = 10 · base · gate`. `playableNow` drops `live === null` or `gate < 0.5`.
- **why** — ordered by each signal's weighted contribution (most-distinctive first), gateReason first when
  gated, capped at 3. `myEntry` and `inWantToTry` are now populated.

**Verified for marcus (basketball):**
```
score personal social proximity  live  gate myEntry  why
 7.8   0.969   null    1.000    0.242   1     —     ["Matches your taste in free courts","0.0 mi away","10 here now · competitive"]
 5.6   0.890   0.802   0.139    0.109   1   #2/5    ["You ranked this #2","Jordan and 4 others rank this top-3","3.7 mi away"]
 4.0   0.278   0.906   0.025    0.349   1     —     ["Jordan and 4 others rank this top-3","Matches your taste in that surface","8 here now · pickup"]
```
- Non-null counts on a 12-item feed: `personal 12, social 10, myEntry 5, inWantToTry 3`; with live
  check-ins refreshed (`pnpm seed:live`), `live` is non-null and `playableNow=true` returns only venues
  with `live !== null`.
- `typeMatch` demonstrably works: a COMPETITIVE check-in scores `live 0.242` for marcus (preferred
  `PICKUP` → ×0.7) while a PICKUP check-in scores `0.349`.
- **No N+1 by construction:** one PostGIS candidate query + one follows lookup + 8 parallel batch queries
  (all keyed `in: ids`) + one weather fetch per unique 5-char geohash. Query count is constant in the
  number of candidates. (Structural — not instrumented with a counter.)

**Note:** because the spec defines `personal` for an already-ranked venue as `rallyScore/10`, the feed
surfaces venues the viewer already ranked near the top (with an honest "You ranked this #2" why). That is
plan-faithful; if you'd rather the feed lean toward discovery, that's a weighting change to discuss.

### Checkpoint 5 — Venue-detail social surfaces + log-flow polish ✅ (awaiting user verification)
**Backend** ([discovery.ts](../apps/api/src/routes/discovery.ts) `/venues/:id`, [ranking.ts](../apps/api/src/routes/ranking.ts)):
- `/api/venues/:id` now returns real personalization for the viewer (via `optionalAuth`): `myEntry`,
  `myNote`, `inWantToTry`, a real `cityRank` (`#rank of N` by shrunkElo among city venues for the primary
  sport), and `friendRankings` (followees who ranked it, each with taste-affinity %, score, rank, note,
  ordered by affinity desc). Also **fixed a latent bug**: reviews/checkIns were returned as raw Prisma rows
  that don't satisfy `ReviewSchema`/`CheckInSchema`, so once reviews existed the RSC's
  `VenueDetailSchema.parse` would have thrown — now mapped to the contract shape.
- New `PATCH /api/entries/:id` (`UpdateEntryBody`, requireAuth, owner-only → 403) persists note/tags.
- Contract: added `myNote`/`cityRank`/`friendRankings` (+`FriendRankingSchema`) to `VenueDetailSchema` and
  `UpdateEntryBody`.

**Frontend** ([venue page RSC](../apps/web/app/(app)/venue/[id]/page.tsx),
[client](../apps/web/app/(app)/venue/[id]/venue-detail-client.tsx),
[log flow](../apps/web/app/(app)/log/[venueId]/page.tsx)):
- RSC now **forwards the Supabase session cookie** to the API so first paint is personalized.
- `FriendRankings` and `Reviews` render real data; `ScoreTriad` shows real FRIENDS (affinity-weighted avg +
  count) and CITY (`#rank of N`); the viewer's own note renders when present.
- Want-to-try is now an **optimistic POST/DELETE with rollback + toast** (was local-state only).
- Log flow rebuilt so transitions are **driven by the API result** (was a fixed counter that skipped
  DETAILS): DETAILS now reliably appears, its submit **PATCHes note/tags**, ProgressDots use the session's
  real `maxSteps`, "Skip ranking" calls the abandon endpoint, and the reveal uses the **actual sport** and
  the real `result.beat` venues ("You ranked X above A and B"). Removed the fabricated "You've liked 5…".

**Verified (API-level, the exact calls the UI makes):**
- Venue a followee ranked → `friendRankings` returns real scores/ranks ordered by affinity; `myEntry`
  `{10, #1/5}`; `cityRank` `#2 of 15`; `reviews` real; `VenueDetailSchema.parse: OK`.
- **Full log flow end-to-end**: `POST /entries` (maxSteps 3) → 3× `POST /comparisons` → result
  `10.0, #1/6, beat=[3 venues]` → `PATCH /entries/:id` note+tags → revisit `GET /venues/:id` shows
  `myEntry {10,#1/6}` and the persisted `myNote`. **PASS.**
- Want-to-try round-trip: `false → POST(201) → true → DELETE(204) → false` (persists across reload).
- `PATCH` ownership guard returns 403 for another user's entry. Full API suite still green (7/7).

**Scope honesty:** verified via the exact API sequence the refactored UI issues + `web typecheck`, **not a
literal browser click-through** (no browser-driver in this environment). One cosmetic seed issue surfaced,
not fixed (out of Checkpoint-5 scope): the 16 synthetic users cycle through only 6 display names, so
friend-rankings can show two real-but-identically-named "Jordan Kim" rows — a one-line seed change when you
want it.

**All five checkpoints complete.** Remaining known gaps live in earlier per-task sections (e.g. deploy
sunset-timezone note, feed recency clustering) and are out of the GOAL.md checkpoint scope.

---

## Runtime verification (2026-07-22) — what actually ran

**Environment:** `DATABASE_URL` = pooled pgbouncer connection
(`aws-1-us-west-2.pooler.supabase.com:6543 … ?pgbouncer=true&connection_limit=1`, transaction mode);
`DIRECT_URL` = port 5432. This matters — see the seed result.

### (1) Tests — ✅ PASS (7/7)
`pnpm --filter api test` → `2 passed (2)`, `7 passed (7)`.
- `core.test.ts` — 6 pure-math tests, 4ms.
- `ranking.integration.test.ts` — 1 HTTP test (POST /entries → comparisons → asserts rankPosition, score,
  and that both Elo rows moved). **Passed, but took 10.5s** for a single flow. It loads the same pooled
  `../../.env`, so this is a real round-trip against pooled Supabase — a single interactive ranking
  transaction works but is pathologically slow. Hold that thought for the seed.

### (2) API boot — ✅ CLEAN
`pnpm --filter api dev` → `Rally API listening on http://localhost:4000` in ~1s. `GET /api/health` →
`{"ok":true}`. Helmet, CORS, and pino-http all active (verified in response headers/logs). No startup errors.

### (3) Key endpoints against the seeded DB — ✅ real data, with the predicted stubs
| Endpoint | Result | Notes |
|---|---|---|
| `GET /api/sports` | ✅ 12 real sports | full objects (slug/name/iconKey/colorHex) |
| `GET /api/venues?…sports=basketball` | ✅ real venues | 180 in DB; **sport filter ignored** — returned a handball court. Confirms the static finding. |
| `GET /api/feed/recommended` (no auth) | ✅ 401 | `requireAuth` works |
| `GET /api/feed/recommended` (authed) | 🟡 15 real venues | but **reco is the stub**: `personal`/`social` = null, `rallyScore` from Elo, `why` = distance only, `live` = null, `myEntry` = null even for a user with entries |
| `GET /api/me/list?sport=basketball` (authed) | ✅ 5 real ranked entries | real scores (10.0 @ #1), correct band counts — the ranking engine's data is genuine |
| `GET /api/feed/social` (authed) | 🟡 12 items | self-only (follows = 0) |

Auth tested with a locally-minted HS256 token for the seeded `marcus` (middleware accepts HS256).

### (4) Seed end-to-end — ✅ NOW COMPLETES (was ❌ hanging) — but latency-bound, not < 90s

**Original run (pooled, before fix):** `pnpm seed` **hung; killed at 300s**. Left 9 orphaned `ACTIVE`
comparison sessions — the fingerprint of dying inside `finalizeSession`, the multi-write interactive
`$transaction`. Over the pooled pgbouncer connection (`connection_limit=1`), that transaction's *concurrent
`Promise.all` writes* can't get a second connection and deadlock. `checkIns: 0` because
`refreshLiveCheckIns()` (last step) never ran.

**Fix applied (2026-07-22):** added a second Prisma client `prismaDirect` pinned to `DIRECT_URL` (session
mode, 5432) in `packages/db/src/index.ts`; routed the interactive `$transaction` write paths
(`createEntryAndSession`, `submitComparison`/`finalizeSession`, `abandonSession`) to it in
`services/ranking/service.ts`; pointed the whole seed batch at it in `scripts/seed.ts`. Pooled `prisma`
still serves normal request-path reads. `pnpm seed:reset` then cleaned the 9 orphans (cascade from `User`).

**Result — full clean `pnpm seed:reset` completed (exit 0):**
`users: 18` ✅ · `venues: 180` · `entries: 180` · `comparisons: 165` · `activities: 180` ·
**`checkIns: 10` (all live)** ✅ · `comparisonSessions: 180` with **`ACTIVE`/orphaned: 0** ✅.
`follows: 0` · `reviews: 0` · `wantToTry: 0` · `tasteAffinity: 0` — expected; the social seed isn't
written yet (separate, deferred finding). The live layer / "Playable now" now has real data.

**Per-transaction timing (before → after):**
- Simplified interactive `$transaction` micro-bench (same script, both clients): **pooled ≈ 950ms avg
  (781ms median)** → **direct ≈ 615ms avg (428ms median)**.
- Real ranking transaction, steady state on direct: **≈ 1.8s wall each** (createEntry / submitComparison
  including surrounding band reads).
- Full flow (integration test, pooled): 10.5s. Full seed: **pooled = never finishes (hang)** →
  **direct = ~14 min wall (851s), start→finish**.

**⚠ The < 90s target is NOT met from this machine, and that is a network fact, not a code one.**
Single-query RTT to the `us-west-2` Supabase pooler from here is **~380ms**; the seed makes several
thousand sequential round-trips (~180 venues × ~5 writes + 345 ranking transactions + band reads), so wall
time is latency-bound at ~14 min. The same seed against an in-region host (CI/Supabase region, sub-ms RTT)
would land well under 90s. The fix removed the hang; it cannot remove the round-trip count or the distance
to the DB.

### Runtime vs. static — reconciliation
- **Confirmed at runtime:** reco is a stub; no follows/reviews/check-ins/want-to-try/affinity in the data;
  `/venues` ignores the sport filter; weather not wired (`gate: 1`); want-to-try not persisted (0 rows).
- **New at runtime (not visible statically):** the seed *hung* on the pooled connection — **now fixed**
  (interactive transactions routed to `DIRECT_URL`); after the fix it completes with 18 users and 10 live
  check-ins, so the live/Playable-now experience now has data. Remaining perf reality: the seed is
  latency-bound (~380ms RTT to us-west-2) and takes ~14 min from this machine, not < 90s. Still open (other
  findings, untouched): `myEntry` not populated on reco cards even when authenticated.
- **Corrected upgrade from the static audit:** the tests are not merely "present" — they **run green (7/7)**,
  and the ranking engine demonstrably produces correct, real ranked lists against the live DB.

---

Static findings below. "Working" in these sections means the code exists and is internally wired; see the
runtime section above for what was actually executed.

**Legend:** ✅ done · 🟡 partial · ❌ missing

**Headline findings**
- Frontend is wired to the **real API**, not mocks: `NEXT_PUBLIC_USE_MOCKS=false` in `.env`, `.env.example`,
  and `apps/web/.env.local`. The mock layer in `api-client.ts` only stubs `/feed/recommended`; the two files
  in `lib/mocks/` are vestigial. So FE/BE integration is genuinely exercised, not faked.
- The **recommendation engine (Task 9) is stubbed** — `/feed/recommended` fakes a score from Elo; no
  personal/social/proximity/live blend, no `recommend.ts`.
- **Weather + PostGIS geo search exist but are orphaned** — `weather.ts` and `packages/db/geo.ts`'s
  `searchVenues`/`playabilityGate`/`getWeather` are never called by any route.
- **Seed omits Follow edges, reviews, historical check-ins, and want-to-try** → social feed, friend
  rankings, and affinity surfaces render largely empty even against seeded data.
- The **PostGIS migration tail was never hand-edited in** — no `venues_geom_gix` GIST index, no
  `checkins_live_idx` partial index, no `follows_no_self` constraint.

---

## Task 01 — Repo scaffold ✅
Monorepo present: `apps/web` (Next 14 App Router), `apps/api` (Express, `app.ts` exports app / `server.ts`
listens), `packages/db`, `packages/shared`. Root `turbo.json`, `tsconfig.base.json`, `.env.example` (all vars),
`prettier.config.mjs`, `vercel.json`, `README`. Express-on-Vercel adapter at
`apps/web/app/api/[[...route]]/route.ts`; `/api/health` returns `{ ok: true }`.
- Note: API routes were consolidated into `me.ts` / `ranking.ts` / `community.ts` / `discovery.ts` rather
  than one file per resource — a structural deviation from the prompts, not a functional gap.

## Task 02 — Prisma schema & PostGIS 🟡
- ✅ All 16 models + 8 enums present with snake_case `@@map`/`@map`, cascade relations, named Follow
  self-relation, every index from the spec, `geom`/`home_geom` `geography(Point,4326)` columns, and
  `CREATE EXTENSION postgis`.
- ✅ `packages/db/src/geo.ts` helpers: `setVenueGeom`/`setUserHomeGeom` (lng-first), `venuesWithinRadius`,
  `searchVenues`. Singleton client + type re-exports in `index.ts`.
- ❌ **The hand-edited migration tail is missing**: no `venues_geom_gix` GIST index, no `checkins_live_idx`
  partial index (`WHERE ended_at IS NULL`), no `follows_no_self` CHECK constraint. Geo/live queries run
  without their intended indexes.

## Task 03 — Shared Zod contract ✅
`packages/shared/src`: `enums`, `entities` (UserMini/Profile, VenueMini/Card/Detail, LiveStatus, Entry,
RankedEntry, ComparisonSession, CheckIn, Review, Activity, LeaderboardRow, RecoComponents, AffinityExplanation),
`requests` (all 11 bodies/queries), `responses` (+ `paginated<T>`), `errors`, `constants` (bands/IDEAL_COUNT/
Elo — values match spec), barrel `index.ts`. Single source of truth, imported by both apps.

## Task 04 — Ranking engine ✅ (backend)
- ✅ `services/ranking/core.ts` — every pure function present and matching spec (`maxSteps`, binary-insert
  helpers, `scoreBand`/`rescoreBand`, `globalPositions`, `expectedScore`/`kFactor`/`eloUpdate`/`shrunkElo`,
  `kendallTau` tau-b, `tasteAffinity`).
- ✅ `service.ts` — `createEntryAndSession`, `submitComparison` (Elo skip on tie, finalize, Activity row,
  affinity recompute), `abandonSession`, `getUserList`, `deleteEntry`. `affinity.ts` present.
- ✅ Tests exist: `core.test.ts` and `ranking.integration.test.ts`.
- 🟡 Minor: `getUserList` does **not** lazily sweep stale `RANKING` entries (>1h); `deleteEntry` deletes but
  does **not** resequence/rescore the band.

## Task 05 — Auth, middleware, error handling ✅
- ✅ `middleware/auth.ts` — `requireAuth`/`optionalAuth`, verifies **both** HS256 (tests) and ES256 (Supabase
  JWKS, 10-min cache) plus cookie-based token extraction. `validate.ts` (422 + flatten). `error.ts`
  (`ApiError`, `asyncHandler`, `notFound`/`forbidden`/`conflict`, leak-safe 500). `app.ts` helmet/cors/json/
  pino → routes → 404 → error handler.
- ✅ Web: `lib/supabase/{client,server,middleware}`, `middleware.ts` route guards, typed `lib/api-client.ts`.
- ✅ `login`/`signup` pages with **"Try as Marcus / Priya" demo buttons**. `me.ts` GET/POST/PATCH (upserts
  UserSport, sets home geom).

## Task 06 — Venue seed pipeline 🟡
- ✅ `scripts/overpass-fetch.ts`, `normalize-venues.ts`, `data/photos.ts` exist.
- ❌ **Committed data is placeholder, not OSM.** `scripts/data/` holds only
  `chicago-venues.normalized.json` (180 rows, `osmId` = `placeholder:*` from
  `generate-placeholder-venues.ts`). No raw Overpass output and **no `chicago-neighborhoods.geojson`** are
  committed; the real fetch/normalize path was never run end-to-end (seed prints a warning about this).

## Task 07 — Seed script 🟡
- ✅ Honors the core constraint: rankings generated via the **real** `createEntryAndSession` +
  `submitComparison`. Seeded mulberry32 RNG, 12 sports, venues + geom + ratings, 2 demo + 16 synthetic users
  via Supabase Admin API, UserSport, sentiment-banded entries, live check-ins (`refreshLiveCheckIns`),
  `recomputeAffinityFor`, `--reset`/`--live-only` scripts.
- ❌ Missing large parts of the spec: **no Follow edges**, **no reviews**, **no historical check-ins (~400)**,
  **no WantToTry**, no archetype feature-vector `trueScore` model (simplified quality+noise), no per-sport
  note bank, and **no Spearman-correlation verification**. Consequence: social/affinity/friend surfaces are
  empty even with a full seed.

## Task 08 — Venue API + geo + weather 🟡
- ✅ Routes present in `discovery.ts`: `GET /venues`, `/venues/:id` (reviews + live embedded),
  `/venues/:id/live`, `/sports` (with `Cache-Control`).
- ❌ **`geo.ts searchVenues` (PostGIS `ST_DWithin`) is unused** — routes use `prisma.findMany` +
  `Math.hypot` distance approximation instead of the geography index.
- ❌ **`weather.ts` (`getWeather`, `playabilityGate`) is unused/orphaned** — venue detail returns
  `gate: 1`, `conditionNotes: null`, no weather.
- ❌ No standalone `GET /venues/:id/reviews` (paginated); no `friendEntries`/`cityStats` in venue detail; no
  `getLiveStatusBatch` / documented N+1 guard.

## Task 09 — Reco / ranking / social / check-in / leaderboard routes 🟡
- ✅ Ranking routes (`ranking.ts`): `/entries`, `/comparisons` (+ session get/abandon), `/me/list`,
  `/users/:handle/list`, `DELETE /entries/:id` — all wired to the real engine.
- ✅ Check-ins (`community.ts`): create (auto-ends prior, writes Activity), active, nearby, patch, end.
- ✅ Social: follows/unfollow, `/users/search`, `/users/:handle` (with follow state), followers/following,
  `/feed/social`, want-to-try (post/delete/list), `/users/:handle/affinity`.
- ✅ Leaderboard: global scope.
- ❌ **`recommend.ts` / `getRecommendations` does not exist.** `/feed/recommended` fakes
  `rallyScore = 5 + (elo-1500)/100`; `personal`/`social` always `null`; no cosine taste vectors, no
  weight-renormalized blend, no live/skill/type match, `why` is only distance/live.
- 🟡 Gaps: `POST /follows` doesn't write `Activity(FOLLOWED)` or trigger affinity recompute; `/feed/social`
  lacks cursor pagination + dead-liveness exclusion; leaderboard orders by raw `elo` (not shrunkElo-in-SQL)
  and has no `friends` scope.

## Task 10 — Design system + shared components 🟡
- ✅ Tokens/dark theme (`globals.css`, `tailwind.config.ts`, rally-* colors), `SportThemeProvider`,
  `ScoreBadge`, `LiveBadge`, `SportChip`, `VenueCard`, `VenuePhoto`, `EmptyState`, `LoadingSkeleton`.
  `/styleguide` exists and is prod-guarded (`notFound()` when `NODE_ENV==='production'`).
- ❌ **shadcn primitive set not installed** — `components/ui/` has only `card.tsx`; button/sheet/dialog/tabs/
  badge/avatar/input/select/slider/toggle-group/sonner/scroll-area are hand-rolled inline in pages.
- ❌ No reusable `ComparisonCard`, `ResultReveal`, `RankedList`, `ConditionGrid`, `MapPin`,
  `UserRow`/`UserAvatar`/`AffinityBadge`, `ActivityCard` — their logic is inlined per page.
- 🟡 Mocks minimal (2 fixture files; api-client mock stubs only `/feed/recommended`) — acceptable since
  mocks are off. `/styleguide` renders only a handful of components, not every state.

## Task 11 — Map home ✅ (mostly)
`app/(app)/page.tsx`: vaul bottom sheet (0.12/0.55/0.92), desktop two-column shell, dynamically-imported
`MapCanvas` (react-map-gl), URL-backed `sport`/`radius`/filters, `TopBar` with prominent **Playable-now**
toggle + live count, `FilterSheet`, `VenueList` sorted by reco score, geolocation → home → Chicago fallback
with "Using your home area" note, `refetchInterval` only when playable. Wired to real `/feed/recommended`.
- 🟡 Verify Supercluster clustering + live-pulse rings in `map-canvas.tsx`; reco `why` chip is inline.

## Task 12 — Venue detail + check-in 🟡
- ✅ RSC shell + `venue-detail-client.tsx`: Hero, Playability banner, LivePanel (45s poll), ScoreTriad,
  Conditions grid, sticky ActionBar, CheckInDialog, plus a RatingPicker.
- ❌ **FriendRankingsList is a hardcoded empty state** (never fetches) — the core social section is a stub.
- ❌ **ReviewList hardcoded empty** (ignores the reviews the API already returns).
- ❌ **Want-to-try toggle is local state only — no POST** to `/want-to-try` (not persisted).
- 🟡 ScoreTriad FRIENDS always `—`; CITY shows the user's personal rank, not city `#rank of N`. No "already
  checked in elsewhere" warning. Playability shows real weather only if the API provided it — it doesn't.

## Task 13 — Log & comparison flow 🟡
- ✅ `useReducer` state machine (SENTIMENT→COMPARING→DETAILS→REVEAL), sentiment screen, inline comparison
  card with keyboard (←/→/Space), skip/abandon, note+tag picker, animated count-up reveal. Wired to real
  `/entries` + `/comparisons`.
- ❌ **DETAILS note/tags are never PATCHed** — captured then discarded.
- 🟡 ProgressDots hardcoded "of 2"; reveal hardcodes "basketball courts" and "above two courts" (ignores
  `result.beat`); no query invalidation, no #1 confetti, non-functional "Check in here"/"View my list" CTAs;
  no session-DONE/403 redirect handling; "You've liked 5 …" count hardcoded.

## Task 14 — Feed / profiles / leaderboard / search / onboarding 🟡
All five routes exist and render real seeded data. Simplified vs spec:
- **Feed** — flat list; no `ActivityCard` variants, no infinite scroll, no CHECKED_IN "Join" card, no
  suggested-users empty state.
- **Leaderboard** — basketball-only; no SportTabs / ScopeToggle / CityPicker / personal-rank chip / Elo
  tooltip.
- **/me** — basic; no SportTabs, no WantToTry / CheckInHistory tabs, no sentiment-band grouping.
- **/u/[handle]** — ✅ follow toggle + ranked list + affinity modal; no SharedVenuesStrip / inline
  per-sport AffinityBadge.
- **Search** — closest to spec (250ms debounce, Venues/People tabs, empty states); no recent-searches.
- **Onboarding** — 4 steps but only 4 sports offered, one global skill level, no location picker (hardcoded
  Chicago), step 4 has no inline ranking. `PATCH /me` works.
- App shell (`app-shell.tsx`) present.

## Task 15 — Polish / states / a11y / perf 🟡
- ✅ `error.tsx` per group + global `not-found.tsx`, `loading.tsx`, skeletons, empty states, API-error toast
  (`rally-api-error` event + `apiErrorMessage`), PWA `manifest.ts`, `opengraph-image.tsx`, `icon.svg`,
  `next/image` via `VenuePhoto`, dynamic mapbox import, styleguide prod-guarded.
- 🟡 Several surfaces use text "Loading…" spinners (`/me`, `/log`, `/u/[handle]`) — contradicts the
  no-spinner goal. Lighthouse/responsive/contrast claims can't be verified from static code (root
  `STATUS.md` claims 98/100 prod).

## Task 16 — Deploy 🟡
- ✅ `vercel.json` (install/build/output/framework, `/api` rewrite, `maxDuration: 30`), `scripts/check-env.ts`
  (validates all required vars), `.github/workflows/ci.yml` (typecheck + lint + `--filter api test`),
  `postinstall: prisma generate`, `next.config.mjs` `remotePatterns` for Supabase + DiceBear.
- ❌ **No `outputFileTracingIncludes` for the Prisma engine** in `next.config` — the classic Vercel-monorepo
  bundling failure is unaddressed. No evidence of an actual deploy / live-URL verification.

## Task 17 — Stretch 🟡 (one of five)
- ✅ **E — Affinity explainer**: `GET /users/:handle/affinity` + `AffinityModal`/scatter on `/u/[handle]`
  (real persisted Kendall τ + overlap). Complete.
- ❌ A (Rally Up), B (photo upload), C (community condition edits), D (popular times) — not started.

---

## Cross-cutting integration status
| Feature | Frontend | Backend | Integrated | Notes |
|---|---|---|---|---|
| Auth / demo login | ✅ | ✅ | ✅ | ES256+HS256, cookie + bearer |
| Map home / feed | ✅ | 🟡 | ✅ | BE reco is a stub |
| Venue detail | 🟡 | 🟡 | 🟡 | friends/reviews/weather/city-rank stubbed |
| Check-in | ✅ | ✅ | ✅ | want-to-try not persisted from detail |
| Log + comparison | 🟡 | ✅ | ✅ | notes/tags dropped; reveal hardcoded |
| Ranking engine | — | ✅ | ✅ | real engine, tested, drives seed |
| Recommendations | 🟡 | ❌ | 🟡 | no real blend/why |
| Social feed / follows | 🟡 | 🟡 | 🟡 | seed has no follow edges → empty |
| Affinity (Task 17E) | ✅ | ✅ | ✅ | complete |
| Leaderboard | 🟡 | 🟡 | ✅ | global-only, raw Elo order |
| Search | ✅ | ✅ | ✅ | |
| Onboarding | 🟡 | ✅ | ✅ | 4 sports, no inline ranking |
| Weather / playability | ❌ | 🟡 | ❌ | service exists, never called |
| Geo (PostGIS) search | — | 🟡 | ❌ | `searchVenues` exists, unused |
| Deploy | — | 🟡 | ❓ | Prisma tracing unaddressed, unverified |

## Highest-leverage gaps to close first
1. Seed **Follow edges + reviews + historical/want-to-try** so social, feed, friend rankings, and affinity
   stop rendering empty on seeded data.
2. Implement the real **recommendation blend** (`recommend.ts`) and wire **weather/playability** + PostGIS
   `searchVenues` into `/feed/recommended` and `/venues/:id`.
3. Wire venue-detail **FriendRankings, Reviews, city rank, and want-to-try persistence** to the API.
4. Persist **log-flow note/tags** and drive the reveal from real `result.beat` / sport.
5. Add the missing **migration tail** (GIST + partial live index + self-follow constraint) and Prisma
   `outputFileTracingIncludes` before deploy.
