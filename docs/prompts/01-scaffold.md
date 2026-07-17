# Task 1 — Repo scaffold

⚠️ **Highest-risk task in the whole plan.** Do this together (both of you, one screen). Time-box the Express-on-Vercel adapter to 45 minutes — if it's fighting you, take the fallback noted below and move on.

```text
Create a pnpm + Turborepo monorepo named "rally" with this exact structure:

apps/web    — Next.js 14 (App Router, TypeScript strict, Tailwind, ESLint), app/ at the package root,
              shadcn/ui initialized (New York style, dark mode default via next-themes, base color slate),
              deps: @tanstack/react-query v5, react-map-gl + mapbox-gl, zod, lucide-react,
                    @supabase/supabase-js, @supabase/ssr, date-fns, clsx, tailwind-merge
apps/api    — Express 4 + TypeScript. src/app.ts EXPORTS the configured express app (no listen).
              src/server.ts imports it and listens on process.env.PORT ?? 4000.
              deps: express, cors, helmet, zod, jsonwebtoken, pino, pino-http; dev: tsx, vitest, @types/*
              Scripts: dev = "tsx watch src/server.ts", build = "tsc -p tsconfig.json", test = "vitest run"
packages/db     — Prisma. Exports a singleton PrismaClient (globalThis-cached to survive HMR/lambda reuse).
packages/shared — Zod schemas + inferred types. Barrel export from src/index.ts. No runtime deps but zod.

Also create:
- Root: package.json (packageManager pnpm@9), pnpm-workspace.yaml, turbo.json (build/dev/lint/typecheck/test
  pipelines with correct dependsOn), .gitignore, .nvmrc (20), .editorconfig, prettier config.
- tsconfig.base.json at root; each package extends it. Path aliases: @rally/shared, @rally/db.
- .env.example at root with EVERY var, each with a one-line comment:
  DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, NEXT_PUBLIC_MAPBOX_TOKEN,
  NEXT_PUBLIC_API_URL, NEXT_PUBLIC_USE_MOCKS, DEMO_PASSWORD,
  RECO_W_PERSONAL=0.35, RECO_W_SOCIAL=0.25, RECO_W_PROXIMITY=0.20, RECO_W_LIVE=0.20,
  RECO_PROXIMITY_D0_KM=3.0
- apps/web/app/api/[[...route]]/route.ts: a catch-all that adapts the Express app from apps/api into a
  Next.js Route Handler. Convert the Web Request into a Node IncomingMessage-like object, run it through
  the express app, and convert the ServerResponse back into a Web Response. Export GET, POST, PATCH, PUT,
  DELETE, OPTIONS. Set `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
  Include a brief comment explaining the adapter. Add /api/health returning { ok: true } so it's testable.
- vercel.json: buildCommand for the monorepo, installCommand "pnpm install", and a rewrite so
  /api/:path* hits the catch-all route.
- README.md stub with the project name and a TODO list.

Verify: `pnpm install && pnpm typecheck && pnpm --filter web dev` serves a page and
`curl localhost:3000/api/health` returns { ok: true }. Also `pnpm --filter api dev` +
`curl localhost:4000/api/health` works standalone. Show me both working.
```

**Verify:** both health checks green.
**Commit:** `chore: monorepo scaffold + express-on-vercel adapter`
**Fallback if the adapter fights you for >45 min:** deploy `apps/api` to Railway instead, set `NEXT_PUBLIC_API_URL`, add CORS. Budget 3 extra hours, decide fast.
