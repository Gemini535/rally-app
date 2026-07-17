# 🏀 Rally

## TODO

- [ ] Build the venue ranking experience
- [ ] Add live check-ins and recommendations
- [ ] Deploy the web app and API adapter

**Find the best courts. Know who's on them right now.**

A Beli-style discovery and ranking app for recreational sports venues — basketball, pickleball,
tennis, soccer, and more. Rank the places you play through head-to-head comparisons, see who's
playing right now, and get recommendations blending your taste, your friends' taste, distance,
and whether the weather will let you play.

🔗 **Live demo:** https://rally.vercel.app
🎥 **Demo video:** <link>
🤖 **Built entirely with Codex 5.6** — see [Built with Codex](#-built-with-codex)

![Rally screenshot](docs/screenshot-hero.png)

---

## The problem

Finding a place to play a pickup sport is unsolved:
- **Discovery.** Google Maps knows a court exists. It doesn't know the rims have no nets, the surface
  floods after rain, or which court has the good runs. Park district sites are asset inventories,
  not recommendations.
- **Liveness.** Pickup sport needs *other people*. Every existing tool is async. You drive 20 minutes
  to an empty court, or to a 14-person waitlist.
- **Taste.** "Best" is personal. A competitive 5-on-5 player and a parent teaching their kid to shoot
  want opposite courts. A 4.3-star aggregate tells neither of them anything.

## The solution

Rally is the first app to rank venues whose quality is a *live function of who's standing on them* —
and to feed that liveness back into the ranking.

1. **Rank what you play.** Log a venue → answer up to 5 head-to-head comparisons → get a personal
   0–10 **Rally Score** and a position in your ranked list for that sport.
2. **See who's there now.** Check in with headcount, game type, and skill level. Everyone nearby sees it.
3. **Get told where to go.** The recommendation blends your taste, your friends' taste (weighted by how
   much your rankings actually correlate), distance, live headcount, and a weather playability gate.

## Features

| | |
|---|---|
| 🎯 **Pairwise ranking** | Sentiment bucket → binary-insertion comparisons → a 0–10 Rally Score. Never more than 5 taps. |
| 🔴 **Live check-ins** | Real-time headcount, game type, skill level. 2-hour TTL. Aggregated on the map. |
| 🧠 **Taste-weighted social** | Kendall's τ between you and each person you follow, per sport. Their opinion is weighted by how much it has actually matched yours. |
| 🌦 **Playability gate** | Open-Meteo + lights + indoor/outdoor → a "playable now" indicator with a human reason. |
| 🗺 **Live map** | Mapbox + PostGIS radius search, sport-colored clustered pins, live pulse rings. |
| 🏆 **City leaderboards** | Confidence-shrunk Elo across every user's head-to-head comparisons, global or friends-only. |
| 📋 **Want to try** | A per-sport shortlist that feeds your recommendations. |
| 📰 **Social feed** | Rankings, check-ins, and want-to-trys from people you follow. |
| 🏟 **12 sports, extensible** | Basketball, pickleball, tennis, soccer, volleyball, baseball, softball, track, driving range, skate, football, handball. Adding a sport is one row. |

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, Mapbox GL JS |
| API | Express 4 + TypeScript (a fully separate app, mounted into Vercel via a serverless adapter) |
| Database | Supabase Postgres 15 + PostGIS, Prisma 5 |
| Auth | Supabase Auth (JWT, verified server-side) |
| Storage | Supabase Storage |
| Contract | Zod schemas shared between client and server (`packages/shared`) |
| Data | OpenStreetMap Overpass API (real Chicago venues), Open-Meteo (weather) |
| Infra | Vercel (single project), pnpm workspaces + Turborepo, GitHub Actions CI |
| **Built with** | **Codex 5.6 — 100% of shipped code** |

## Architecture

![Architecture](docs/architecture.png)

Browser (Next.js) → `/api/*` → Express (running as a Vercel serverless function) → Prisma → Supabase
Postgres + PostGIS. `packages/shared` holds the Zod contract both sides import, so the API and the UI
cannot drift.

The API is a genuinely standalone Express app (`pnpm --filter api dev` runs it on `:4000`) mounted into
the Next.js project through a single catch-all route handler. We get real separation of concerns and one
deploy target — see [Architectural decisions](docs/CODEX.md#architectural-decisions).

**Key services** (`apps/api/src/services/`):
- `ranking/core.ts` — pure ranking math (binary insertion, band scoring, Elo, Kendall's τ). Unit-tested,
  zero DB access.
- `ranking/service.ts` — transactional orchestration of a comparison.
- `recommend.ts` — the Rally Score blend.
- `geo.ts` — PostGIS radius search via typed `$queryRaw`.
- `weather.ts` — Open-Meteo with a 30-minute geohash-keyed cache + the playability gate.

## Getting started

### Prerequisites
- Node 20+, pnpm 9+
- A Supabase project (free tier)
- A Mapbox access token (free tier)

### 1. Install
```bash
git clone https://github.com/<you>/rally.git && cd rally
pnpm install
```

### 2. Environment
```bash
cp .env.example .env
```
Fill in:

| Var | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → **Connection pooling** (port 6543). Append `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Same page, **direct** connection (port 5432). Used only for migrations. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**secret** — seed script only) |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Settings |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | mapbox.com → Account → Tokens |
| `DEMO_PASSWORD` | Anything. Used for all seeded accounts. |

Enable PostGIS: Supabase → Database → Extensions → enable `postgis`. (The initial migration also does
this, but enabling it in the dashboard first avoids a permissions edge case.)

### 3. Database
```bash
pnpm --filter @rally/db exec prisma migrate deploy
pnpm --filter @rally/db exec prisma generate
```

### 4. Seed
```bash
pnpm seed          # ~90s: ~180 real Chicago venues from OSM + 18 users with full ranking history
pnpm seed:live     # ~2s: refresh live check-ins to "now" — run this before any demo
```
The venue data is committed at `scripts/data/chicago-venues.raw.json`, so seeding does not depend on
Overpass being reachable. To re-fetch: `pnpm seed:venues:fetch && pnpm seed:venues:normalize`.

### 5. Run
```bash
pnpm dev                      # web on :3000, API mounted at /api
pnpm --filter api dev         # optional: run the API standalone on :4000
```
Open http://localhost:3000

### Demo credentials
| Account | Email | Password | Profile |
|---|---|---|---|
| Marcus | `marcus@rally.demo` | `rallydemo2026` | Basketball, advanced, Logan Square. 9 ranked venues, 6 follows. |
| Priya | `priya@rally.demo` | `rallydemo2026` | Pickleball + tennis, Andersonville. 7 ranked venues, in a live check-in cluster. |

Both are one-tap buttons on the login screen.

### Other commands
```bash
pnpm typecheck              # all packages
pnpm --filter api test      # ranking engine unit + integration tests
pnpm seed:reset             # wipe app data (keeps sports), then re-seed
pnpm --filter @rally/db exec prisma studio
```

## Folder structure

```
rally/
├─ apps/
│  ├─ web/                     # Next.js 14 frontend
│  │  ├─ app/
│  │  │  ├─ (auth)/            # login, signup
│  │  │  ├─ (app)/             # authenticated shell: map, venue, log, feed, leaderboard, profile
│  │  │  ├─ onboarding/
│  │  │  └─ api/[[...route]]/  # ← the Express adapter. The ONLY backend code in apps/web.
│  │  ├─ components/           # ui/ venue/ ranking/ map/ social/ feed/ shared/
│  │  └─ lib/                  # api-client, supabase, query, mocks
│  └─ api/                     # Express API — standalone-runnable
│     └─ src/
│        ├─ app.ts             # the express app (no listen — the adapter imports this)
│        ├─ server.ts          # local standalone entrypoint
│        ├─ middleware/        # auth, validate, error
│        ├─ routes/            # venues, entries, comparisons, checkins, social, feed, leaderboard
│        └─ services/          # ranking/ recommend geo weather live venues affinity
├─ packages/
│  ├─ db/                      # Prisma schema, migrations, client singleton, PostGIS helpers
│  └─ shared/                  # Zod schemas + types — the API contract, imported by both apps
├─ scripts/
│  ├─ overpass-fetch.ts        # pull real Chicago venues from OpenStreetMap
│  ├─ normalize-venues.ts      # clean, dedupe, geographically spread, cap per sport
│  ├─ seed.ts                  # synthetic users + ranking history via the REAL ranking engine
│  └─ data/                    # committed raw + normalized venue JSON, neighborhood polygons
└─ docs/
   ├─ CODEX.md                 # ← how this was built with Codex 5.6
   ├─ prompts/                 # the exact 17 prompts used, in order
   └─ architecture.png
```

## How the ranking works

**Your personal score.** When you log a venue you first pick a sentiment (*liked it* / *it was fine* /
*didn't like it*), which puts it in one of three score bands (6.7–10.0 / 3.4–6.6 / 0.0–3.3). Rally then
binary-searches your existing list *within that band* — `ceil(log2(n+1))` comparisons, capped at 5 — and
splices it in. Your score is your position within the band, linearly interpolated across the band's range.
Positions and scores are recomputed for the whole band on every insert, server-side, in one transaction.

**The city leaderboard.** Every comparison is also a head-to-head match between two venues. We run an
online Elo update — which is exactly stochastic gradient ascent on the Bradley–Terry log-likelihood, one
observation at a time — with a K-factor that decays as a venue accumulates comparisons. The leaderboard
orders by a confidence-shrunk rating, `1500 + (elo − 1500) · n/(n+8)`, so a venue with two comparisons
can't top the board.

**Who to trust.** For each person you follow, Rally computes Kendall's τ-b between your rankings and
theirs over the venues you've both ranked, per sport. That becomes an affinity weight on their opinion in
your recommendations. Someone whose taste matches yours moves your feed; someone whose doesn't, doesn't.

**Where to go now.** `rallyScore = 10 × (Σ wₖ·signalₖ) × gate`, over personal fit (0.35), affinity-weighted
social signal (0.25), proximity (0.20, `exp(−d/3km)`), and liveness (0.20). Null signals are dropped and
their weight redistributed — an empty court is *unknown*, not *bad*. `gate` is a multiplier from weather,
lights, and sunset. Every component is returned in the API response, which is why every recommendation
can explain itself.

## 🤖 Built with Codex

Every line of Rally's shipped code was generated by prompting **Codex 5.6**. See **[docs/CODEX.md](docs/CODEX.md)** for:
- Which components Codex generated unassisted vs. iteratively vs. hand-edited
- Five moments Codex meaningfully accelerated the build
- Architectural decisions and their rationale
- The full prompt sequence (17 sessions) used to build this, verbatim in [`docs/prompts/`](docs/prompts/)
- A time-saved estimate

## Roadmap
- **Rally Up** — post an intent to play at a time and venue; others RSVP. Discovery → coordination.
- **Multi-city** — the schema and seed pipeline are city-agnostic; adding a city is a bbox and a re-run.
- **Popular times** — the historical check-in data is already there.
- **Native app** — the check-in loop wants a lockscreen widget and geofenced prompts.

## License
MIT
