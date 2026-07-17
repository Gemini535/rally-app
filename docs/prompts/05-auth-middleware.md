# Task 5 — Auth, middleware, error handling

```text
Wire Supabase Auth end to end.

apps/api/src/middleware/auth.ts
  - requireAuth: read `Authorization: Bearer <jwt>`, verify with jsonwebtoken against
    process.env.SUPABASE_JWT_SECRET (HS256), attach req.user = { id: payload.sub, email: payload.email }.
    401 UNAUTHORIZED on missing/invalid/expired.
  - optionalAuth: same, but continue with req.user = null if absent or invalid.
  - Augment Express's Request type via declaration merging in apps/api/src/types/express.d.ts.

apps/api/src/middleware/validate.ts
  - validate({ body?, query?, params? }) -> middleware that parses and REPLACES req.body/query/params
    with the parsed values (so handlers get typed, coerced data). On failure: 422 VALIDATION_ERROR
    with details = z.flatten().

apps/api/src/middleware/error.ts
  - ApiError class (code, status, message, details) + helpers notFound(), forbidden(), conflict().
  - Final error handler: ApiError -> its status; ZodError -> 422; anything else -> 500 INTERNAL
    (log the real error with pino; never leak it to the client).
  - asyncHandler wrapper so route handlers can throw.

apps/api/src/app.ts
  - helmet, cors (origin from env, credentials true), express.json({ limit: '1mb' }), pino-http,
    then routes, then a 404 handler, then the error handler. Everything mounted under /api.

apps/web/lib/supabase/  (using @supabase/ssr)
  - client.ts (browser), server.ts (RSC/route handlers, cookie-based), middleware.ts (session refresh)
  - apps/web/middleware.ts: refresh the session; redirect unauthenticated users from
    /, /feed, /me, /leaderboard, /log/* to /login; redirect authenticated users away from /login, /signup;
    redirect authenticated users with no UserSport rows to /onboarding.

apps/web/lib/api-client.ts
  - A typed fetch wrapper: read the Supabase access token, set the Bearer header, prefix
    NEXT_PUBLIC_API_URL ?? '/api', parse JSON, and on !res.ok throw an ApiError carrying
    { code, message, details }. Validate responses with the shared Zod schema when one is passed.
  - Export api.get<T>(path, schema?), api.post<T>(path, body, schema?), api.patch, api.delete.

apps/web/app/(auth)/login/page.tsx + signup/page.tsx
  - shadcn Card + Form. Email/password. Signup collects handle + displayName and on success POSTs to
    /api/me to create the User row (id = auth uid). Handle collision -> friendly inline error.
  - ON THE LOGIN PAGE: two prominent "Try as Marcus (basketball)" / "Try as Priya (pickleball)" buttons
    that sign in with the demo credentials from env (NEXT_PUBLIC_DEMO_EMAIL_1 / _2 /
    NEXT_PUBLIC_DEMO_PASSWORD). This is a judged demo — one-tap login is a requirement, not a nicety.

apps/api/src/routes/me.ts
  - GET /api/me (requireAuth) -> UserProfile; 404 if no User row yet.
  - POST /api/me (requireAuth) -> create the User row for req.user.id (handle, displayName).
    409 on duplicate handle.
  - PATCH /api/me (requireAuth) -> UpdateMeBody; upserts UserSport rows; sets homeGeom via the geo helper.

No Postgres trigger is needed — we create the User row explicitly from POST /api/me. Note that in a comment.

Verify: sign up in the browser, confirm a row lands in public.users with id === auth uid,
`curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/me` returns the profile, and an
unauthenticated call returns 401 UNAUTHORIZED.
```

**Verify:** signup → row → authed curl → 401 on anon.
**Commit:** `feat: supabase auth, middleware, typed api client`
