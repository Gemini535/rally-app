# Rally status

## 11 — Map home

- Complete: responsive map/list shell, mobile Vaul snap-sheet, URL-backed filters, Supercluster map path, bidirectional venue selection, and live-only refresh/filter behavior.
- Verified: `pnpm --filter web typecheck`.
- Browser-verified with local fixtures: ranking is descending, seven live venues remain after enabling **Playable now**, and desktop map/list rendering works without a Mapbox token through the intentional visual fallback.
- Pending environment verification: run against the seeded API with `NEXT_PUBLIC_USE_MOCKS=false` and set `NEXT_PUBLIC_MAPBOX_TOKEN` to exercise Mapbox tiles and real clusters.

## 12 — Venue detail + check-in

- Complete: server-rendered venue shell and metadata, considered live/playability/score/conditions sections, sticky actions, and an optimistic check-in dialog with 45-second live polling.
- Verified: `pnpm --filter web typecheck`.
- Pending API contract work: populated friend-ranking/review data and the active-check-in/want-to-try endpoints need their corresponding Task 9 API responses for real-data verification.

## 13 — Log + comparison flow

- Complete: explicit reducer state machine, sentiment selection, keyboard/tap comparison UI, optional notes/tags, and animated score reveal.
- Verified: `pnpm --filter web typecheck` and `pnpm --filter api test` (6 ranking-core tests).
- Pending real-data verification: the ranking API needs contract-shaped session responses so the flow can drive a seeded Marcus account rather than its no-network demo path.

## 16 — Deploy configuration

- Complete: Vercel build/function configuration, Prisma generation hook, environment validator, CI workflow, and image host policy.
- Verified: `pnpm typecheck` (all six workspace tasks passed) and `pnpm --filter api test`.
- Pending manual production work: configure Vercel environment variables, deploy, check the traced Prisma engine in the generated function, and exercise the phone/cellular loop on the live URL.

## Acceptance verification

- Pass: `pnpm --filter api test` now includes `ranking.integration.test.ts`, which performs HTTP `POST /entries` and `POST /comparisons`, then asserts rank positions, scores, and both changed Elo rows.
- Pass: seeded Marcus curl flow returned a score-reveal payload with `rallyScore: 10`, `rankPosition: 1`, `totalRanked: 5`, and two beaten venues.
- Pass: standalone API `/api/health` and the Next adapter `/api/health` both returned `{ "ok": true }`.
- Note: the configured Supabase instance issues ES256 access tokens while the requested middleware intentionally verifies HS256. The curl acceptance check therefore uses a locally signed HS256 token for the seeded Marcus subject; production should either configure Supabase for HS256 or extend middleware for its JWKS keys.
- Pass: `pnpm dev` booted both `web` on :3000 and `api` on :4000 without runtime errors; both health endpoints returned `{ "ok": true }`.

## Phase 1 — ES256 Supabase authentication

- Pass: middleware now caches Supabase JWKS EC P-256 keys for ten minutes and verifies ES256 issuer/signature/expiry, while preserving HS256 verification for tests.
- Pass: a real Marcus Supabase access token returned his `/api/me` profile; malformed bearer token returned `401 UNAUTHORIZED`.
- Pass: `pnpm --filter api test` and `pnpm typecheck`.

## Phase 2 — Task 9 route surface

- Pass: registered entries/comparisons, check-ins (including active/nearby), recommendations, venues, sports, social follows/feed/user search/profiles, leaderboard, and want-to-try.
- Pass: real Marcus requests returned populated recommendation cards with product-facing `why` strings; active check-in, social feed, and leaderboard all returned HTTP 200.
- Pass: `pnpm --filter api typecheck` and `pnpm --filter api test` (7 tests).

## Phase 3 — Prompt 14

- In progress: app shell and real-data route shells for feed, profile, leaderboard, search, and onboarding were added with mocks disabled.
- Blocked verification: browser login reaches the real map with a valid Supabase session, but its recommendation query renders an empty list despite the same authenticated API request returning populated cards via curl. Phase 4 has not started.
- Stopped after the second check of this cause: after consolidating browser/server to port 3000 and routing browser requests through the Next adapter, React Query still stays indefinitely in `Loading…` for real API calls while direct `curl http://localhost:3000/api/leaderboard?sport=basketball` returns populated JSON. Phase 4 and Prompt 17 remain intentionally unstarted.
- Resolved: that behavior was stale Next-server port contention, not a React Query or API failure. With both stale listeners removed and one clean port-3000 server, browser map cards/pins and leaderboard rows render from seeded real data; `/me` shows Marcus. Phase 3 remains incomplete because the richer Prompt 14 profile/feed/onboarding interfaces still need implementation.
- Progress: replaced the temporary JSON feed/profile/leaderboard route shells with seeded-data UI surfaces. `pnpm --filter web typecheck` passes. Phase 4 is still not started.
- Progress: onboarding now implements the four requested stages and persists selected sports, skill/game defaults, and Chicago home location through the real `/api/me` route. `pnpm --filter web typecheck` passes.
- Pass: fixed venue-detail RSC real-data fetching and the shared contract's local seed-photo path support. Browser verified a seeded venue detail with hero, playability, empty live state, conditions, and actions; no runtime error.
- Progress: log flow now reads the actual venue endpoint, sends real entry/session identifiers to ranking endpoints, and is linked from the venue action bar. `pnpm --filter web typecheck` passes.
- Blocked Phase 3 verification: the real browser `POST /api/entries` log submission remained pending beyond 22 seconds on two attempts, leaving the sentiment controls disabled. The temporary client timeout confirmed the request reached the route; removing it did not resolve the pending request. Per the stop rule, Phase 4 and Prompt 17 remain unstarted.
- Fail (second isolated check): standalone `POST http://localhost:4000/api/entries` completed in 1.62s for seeded Marcus, while the identical authenticated `POST http://localhost:3000/api/entries` timed out after 30s and then 25s. Moving the adapter body emission until after Express attached its parser did not change the behavior. This is a Next Fetch-to-Express POST bridge defect, not a ranking or database failure. Per the requested two-failure stop rule, Phase 3 is stopped; Phases 4 and 5 remain unstarted. `pnpm typecheck` and `pnpm --filter api test` still pass.
- Resolved POST bridge: replacing the synthetic `IncomingMessage` with a `Readable` request stream carrying the Fetch body/HTTP metadata made authenticated Next `POST /api/entries` complete in 1.52s. Browser verification then completed the real Marcus log flow through two comparisons to the reveal (`10.0`, `#1 of 5`). The entry transaction now also uses the longer Supabase-safe timeout.
- In progress: profile ranking lists now use a trimmed numeric wire response rather than raw Prisma records. The active local browser session still leaves its second authenticated list request pending despite the same bearer-authenticated endpoint returning immediately with curl. An attempted access-token header path hangs in this browser runtime and was reverted. Phase 3 remains incomplete; Phases 4 and 5 remain unstarted.
- Resolved browser API revalidation: Express returned `304 Not Modified` for an ETag request and the Next adapter incorrectly attempted `new Response(body, { status: 304 })`, which throws because Fetch forbids a 304 body. The adapter now supplies `null` for 204/205/304 and the browser API client uses `cache: 'no-store'`. Marcus `/me` is browser-verified with five real ranked venues and numeric scores. Route audit is in progress; Prompt 15 has not started.
- Phase 3 route gate pass: after a clean web restart, browser routes `/`, `/me`, `/feed`, `/leaderboard`, `/search`, `/u/priya`, and `/onboarding` render seeded real data (or their intentional setup surface) with no 404s and no current console errors. The real log comparison/reveal was previously exercised to `10.0`, `#1 of 5`. Phase 4 has started.
- Phase 4 progress: added app-route recovery UI, global not-found recovery, TanStack Query retry/backoff, offline status, focus-visible styles, and reduced-motion overrides. `pnpm typecheck` passes; API test suite remains green.
- Phase 4 progress: added application metadata and an installable standalone PWA manifest with the dark Rally theme. Latest `pnpm typecheck` and `pnpm --filter api test` pass (7 tests).
- Phase 4 progress: deferred the Mapbox/react-map-gl surface behind a dynamic import with a layout-stable loading fallback. `pnpm --filter web typecheck` passes.
- Phase 4 progress: added feed, leaderboard, app-shell, and search skeleton/empty states; app/auth recovery routes; PWA manifest/icon; and a venue Open Graph image route. Remaining Phase 4 verification still includes the full responsive/Lighthouse/state screenshot matrix.
- Phase 4 audit: Lighthouse via `pnpm dlx lighthouse` on the development `/` route measured performance 68 and accessibility 100. The performance target is not yet met; production-build measurement is still required before diagnosing the dev-server score.

## Phase 4 — Prompt 15

- Pass: recovery UI, global not-found, friendly API-error toasts, query retry/backoff, offline status, focus-visible styling, reduced-motion overrides, loading skeletons, and player-facing empty states are present with mocks disabled.
- Pass: production Lighthouse measured `/` at **98 performance / 100 accessibility** and `/venue/6f494531-b8fa-4944-be71-ef07daac7ee7` at **99 performance / 100 accessibility**. The venue audit findings (low-contrast labels and unnamed back link) were corrected before the final run.
- Pass: production browser checks found no console warnings or errors on the map or venue detail; both surfaces rendered real seeded data, including real recommendation explanations. `pnpm typecheck` and `pnpm --filter api test` passed (7 tests).

## Phase 5 — Prompt 17 stretch E

- Pass: added the authenticated `GET /api/users/:handle/affinity` contract and a profile affinity-explainer dialog. It plots shared ranked venues and reports the real persisted Kendall τ / overlap count rather than a client-calculated score.
- Pass: `pnpm typecheck`, `pnpm --filter api test` (7 tests), and `pnpm --filter web build` all pass after the stretch feature.
- Pass: authenticated standalone API verification returned HTTP 200 from `/api/users/priya/affinity`; this seed pair currently has zero overlapping ranked venues, so the UI intentionally presents the “rank shared venues” empty explanation rather than inventing an affinity.
