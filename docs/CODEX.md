# Built with Codex 5.6

Every line of shipped code in Rally was produced by prompting Codex 5.6. Two people, four days,
17 planned sessions + follow-ups. This document was written **during** the build, not reconstructed after.

> **Filling-in discipline:** after each Codex session, before you commit, add the row below. 60 seconds,
> both people do it, every time. Reconstructing this Monday afternoon produces a visibly worse artifact —
> you'll forget the specifics, and specifics are the entire point. Judges can tell the difference.

## How we worked

We wrote the full architecture, data model, and ranking algorithm as a specification first, then
translated it into 17 discrete, ordered Codex prompts — each scoped to roughly one session's work, each
with an explicit verification step (see [`docs/prompts/`](prompts/)). A standing preamble carried the
invariants (monorepo layout, strict TypeScript, Zod at every boundary, server owns ranking state) into
every session so we never re-litigated them.

The highest-leverage decision was freezing the API contract in `packages/shared` as Zod schemas before
building either side. With the contract fixed, one of us prompted Codex to build the Express services
while the other prompted it to build the entire UI against generated mocks — genuinely in parallel, with
one integration session on Day 2 rather than four days of coordination.

## Session log

_Fill in as you go — verdict + iteration count, right after each session._

| # | Session | Codex output | Verdict | Iterations |
|---|---|---|---|---|
| 1 | Monorepo scaffold + Express-on-Vercel adapter | | | |
| 2 | Prisma schema + PostGIS migration | | | |
| 3 | Zod API contract | | | |
| 4 | Ranking engine + tests | | | |
| 5 | Auth + middleware + typed client | | | |
| 6 | Overpass fetch + venue normalization | | | |
| 7 | Seed script | | | |
| 8 | Venue API + geo + weather | | | |
| 9 | Reco + social + leaderboard | | | |
| 10 | Design system + components | | | |
| 11 | Map home | | | |
| 12 | Venue detail + check-in | | | |
| 13 | Log + comparison flow | | | |
| 14 | Feed, profiles, leaderboard, search, onboarding | | | |
| 15 | Polish pass | | | |
| 16 | Deploy | | | |
| 17 | Stretch feature | | | |

**Legend:** 🟢 Unassisted (shipped essentially as generated) · 🟡 Iterated (2–4 prompts to converge)
· 🔴 Hand-edited (we edited the output directly — note why below)

## Where Codex was fully autonomous

<!-- Be SPECIFIC. Not "the schema" — "all 15 models, 9 enums, and 11 indexes from a one-page
     description, correct on the first pass including the composite PK on VenueSportRating and the
     partial index predicate on check_ins." -->

- **`packages/db/schema.prisma`** —
- **`packages/shared`** —
- **`apps/api/src/middleware/`** —
- **Component library (~24 components)** —

## Where Codex needed iteration

<!-- Be honest. Judges trust an honest account more than a flawless one, and "we found the failure
     mode and fixed the prompt" IS the skill being judged. -->

| Area | What went wrong first | What fixed it |
|---|---|---|
| Express-on-Vercel adapter | | |
| PostGIS via Prisma | | |
| Ranking finalization | | |

## Where we hand-edited

<!-- If nothing: say so — that's a stronger claim. If something: say exactly what and why. -->

## Five moments Codex meaningfully accelerated the work

<!-- These are the paragraphs judges actually read. Each needs: what we gave it, what came back, what
     it would have cost by hand. Write them the day they happen, not from memory later. -->

### 1. The entire Prisma schema from a one-page spec
**Prompt:** ~1 page of prose describing 15 entities and their relationships.
**Output:**
**Time:**

### 2. Diagnosed a PostGIS bug from a single error paste
<!-- The lat/lng argument-order bug flagged in the plan is a likely candidate. Record what actually happened. -->

### 3. The ranking engine's test suite, unprompted in scope

### 4. The seed script as an end-to-end test
**Decision:** the seed generates all ranking data by calling the *production* ranking service, never by
writing scores directly — so the Spearman correlation check between recovered Elo and hidden latent
quality (ρ = ___) is real proof the engine works, found on Day 2 instead of Day 4.

### 5. <the one that surprised you — leave this slot open until it happens>

## Architectural decisions

| Decision | Why | Alternative rejected |
|---|---|---|
| Express mounted into Vercel via a catch-all adapter (or: separate Next.js API routes with a `/server` split — record which you actually chose) | | |
| Zod contract in `packages/shared`, frozen night one | | |
| Prisma + raw SQL for geo | | |
| Sentiment bands before binary search | | |
| Elo alongside personal ranking, not instead of it | | |
| Scoring in TypeScript, not SQL | | |
| Null signals dropped and reweighted, not zeroed | | |
| Seed data via the production ranking engine | | |

## Time saved (estimate)

<!-- Track actual session start/end times as you go. A fabricated table is worse than none — judges
     have built things too. -->

| Area | Hand-written estimate | Actual with Codex | Saved |
|---|---|---|---|
| Scaffold + config + deploy | | | |
| Schema + migrations | | | |
| API contract | | | |
| Ranking engine + tests | | | |
| Seed pipeline (OSM + synthetic) | | | |
| API routes + services | | | |
| Component library | | | |
| Screens | | | |
| Polish | | | |
| **Total** | | | |

## The prompts

The full prompt sequence is in [`docs/prompts/`](prompts/), verbatim, in the order we ran them.
