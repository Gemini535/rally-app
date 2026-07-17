# Rally — Agent Instructions

Project: Rally — a Beli-style ranking + live-discovery app for recreational sports venues.

Monorepo: pnpm workspaces + Turborepo.
- `apps/web`   — Next.js 14 App Router, TypeScript strict, Tailwind, shadcn/ui
- `apps/api`   — Express 4 + TypeScript, standalone-runnable, mounted into Vercel via a serverless adapter
- `packages/db`     — Prisma schema + client (Supabase Postgres + PostGIS)
- `packages/shared` — Zod schemas + inferred types; THE API contract, imported by both apps

## Working rules
- TypeScript strict. No `any`. Zod-validate every API boundary.
- Never import from `apps/web` into `apps/api` or vice versa. Share only via `packages/shared`.
- Geo goes through `prisma.$queryRaw` with typed wrappers in `apps/api/src/services/geo.ts`.
  Prisma has no PostGIS type; `venues.geom` is `Unsupported("geography(Point,4326)")`.
- The server owns all ranking state. The client never computes scores or positions.
- Every list surface needs a loading skeleton and an empty state. No spinners, no blank screens.
- Keep files under ~250 lines. Extract when longer.

## After every task
Print: (1) files created/modified, (2) the exact commands to verify what you built,
(3) anything you assumed that I should confirm.

## Build sequence
Full task-by-task build plan and 17 sequenced prompts live in `docs/prompts/`. Work through them in
order (01 → 17). Each has its own verification step — don't move to the next until the current one's
verify step passes.
