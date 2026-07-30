# Rally — Build Goal

## The goal (definition of "done")

Rally is a fully integrated, locally-runnable app where a real user can complete the entire core loop
against the real API with no stubs, no mock data, and no orphaned services:

> Sign up → onboard (pick sports, skill, home, rank 3 venues) → see a live map with **real personalized
> recommendations** → open a venue and see its **live status, weather playability, friends' rankings, and
> reviews** → log a visit through the comparison flow → get a **real Rally Score** → see it appear in their
> ranked list AND in their friends' social feed → the recommendation feed reflects the new ranking.

"Done" means every feature the frontend renders is backed by real, correctly-computed data — not a
hardcoded empty state, not a stub score, not an orphaned service that exists but is never called.

## Ground state (verified, do not re-litigate)

- Ranking engine (Task 4): complete, tested, produces correct real ranked lists.
- Auth (Task 5): complete.
- The pooled-connection interactive-transaction hang: **fixed** — writes routed to `prismaDirect`
  (DIRECT_URL). Seed completes clean: 18 users, 180 venues, 180 entries, 165 comparisons, 10 live
  check-ins, 0 orphaned sessions.
- Frontend is wired to the real API (`NEXT_PUBLIC_USE_MOCKS=false`); the mock layer is vestigial.

## Checkpoints (work in order; verify each before starting the next)

### Checkpoint 1 — Foundation gaps
- Apply the missing PostGIS migration tail (Task 2): `venues_geom_gix` GIST index, `checkins_live_idx`
  partial index, `follows_no_self` check constraint. (Verify they didn't get added later first.)
- Fix the `/api/venues` sport filter (`sports=basketball` returned a handball court).
- **Done when:** the indexes/constraint exist in the DB, and `GET /api/venues?sports=basketball` returns
  only venues that host basketball.

### Checkpoint 2 — Seed the social graph
- Add to the seed: ~5 follows/user (both demo accounts densely connected, ≥2 high-overlap each), reviews on
  ~25% of entries (attribute-consistent), ~400 historical check-ins, 2-4 want-to-try/user, and compute
  `tasteAffinity` for all followed pairs.
- **Done when:** after a reseed, `follows`, `reviews`, `wantToTry`, and `tasteAffinity` counts are all
  non-zero, and `/api/feed/social` for marcus shows activity from *other* users, not self-only.

### Checkpoint 3 — Wire the orphaned services
- Route venue search through `geo.ts`'s PostGIS `searchVenues`; route venue detail through `weather.ts` for
  real playability.
- **Done when:** `GET /api/venues/:id` returns a real `weather` object and a real `gate`/`gateReason` (not
  hardcoded 1), and distances come from PostGIS, not `Math.hypot`.

### Checkpoint 4 — The real recommendation engine
- Implement the full blend per plan §7D (Task 9): personal, affinity-weighted social, proximity, liveness,
  weather gate — with null-signal reweighting and real `why` strings. Populate `myEntry` and
  `reco.components`.
- **Done when:** `/api/feed/recommended` for marcus returns non-null `personal`/`social` components where
  applicable, real multi-factor `why` strings, and populated `myEntry` on venues he's ranked.

### Checkpoint 5 — Venue-detail social surfaces + log-flow polish
- Wire FriendRankings and Reviews to real data; make want-to-try POST; fix CITY rank to real city ranking;
  persist log-flow notes/tags; make the reveal use the actual sport.
- **Done when:** on a venue a friend has ranked, the friend-rankings section shows their real score;
  want-to-try persists across reload; a logged note appears when you revisit the entry.

## Out of scope (do not do)
- Deploy/Vercel work (Task 16) — local-first for now.
- Seed round-trip optimization / batching — the 14-min local seed is fine.
- Production connection-pooling redesign — noted for later.
- Real OSM venue data — placeholder Chicago venues are fine until the app works end-to-end.
