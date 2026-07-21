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
