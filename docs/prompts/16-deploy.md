# Task 16 — Deploy

⚠️ Do this on Day 2, not Day 4. A deploy that first runs on the last day is a deploy that fails on the last day.

```text
Ship to Vercel as a single project.

1. vercel.json at the root:
   - installCommand "pnpm install", buildCommand "pnpm turbo run build --filter=web...",
     outputDirectory "apps/web/.next", framework "nextjs"
   - the /api/:path* rewrite to the catch-all route
   - functions: { "apps/web/app/api/[[...route]]/route.ts": { maxDuration: 30 } }
2. Confirm the Express adapter runs on Vercel's Node runtime. The Prisma client must be generated during
   the build (postinstall: "prisma generate" in packages/db) and bundled — VERIFY the .prisma engine is
   actually included in the lambda; add outputFileTracingIncludes in next.config if not. This is the
   classic Prisma-on-Vercel-monorepo failure. Check it explicitly; do not assume.
3. Supabase connection: use the POOLED string (pgbouncer, port 6543) with
   ?pgbouncer=true&connection_limit=1 for DATABASE_URL in the lambda, and the DIRECT (5432) URL for
   DIRECT_URL so migrations work. Explain the distinction in a comment in .env.example.
4. Document every env var needed in Vercel, split by scope (build vs runtime, public vs secret). Write
   scripts/check-env.ts validating all required vars with Zod at boot, failing loudly with a list of
   what's missing. Run it in the build.
5. GitHub Action (.github/workflows/ci.yml): on PR, run typecheck + lint + `pnpm --filter api test`.
   No deploy step (Vercel's Git integration handles that).
6. Seeding production: document the exact command to run seed.ts against the prod DATABASE_URL, and make
   `pnpm seed:live` runnable against prod. That is the pre-demo command.
7. next.config.ts: images.remotePatterns for Supabase Storage + DiceBear.
8. After deploying, verify against the LIVE URL and paste the output:
   - /api/health
   - /api/venues?lat=41.88&lng=-87.63&radius=5000&sports=basketball
   - log in as the demo account, load the map, log a venue end to end
9. Print the production URL and a checklist of anything I must set manually in the Vercel dashboard.

Verify: the full loop works on the deployed URL, from a phone, on cellular. Actually test it on a phone.
```

**Verify:** full loop on the live URL from a phone.
**Commit:** `chore: vercel deploy config + ci`
