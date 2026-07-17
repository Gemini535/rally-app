# Task 3 — Shared Zod contract

```text
In packages/shared, define the complete API contract as Zod schemas with inferred TS types.
This package is the single source of truth — both apps import from it and nothing else defines these shapes.

src/enums.ts     — Zod enums mirroring every Prisma enum (SportSlugSchema, SentimentSchema, ...)
src/entities.ts  — UserMiniSchema, UserProfileSchema, VenueMiniSchema, VenueCardSchema,
                   VenueDetailSchema, LiveStatusSchema, EntrySchema, RankedEntrySchema,
                   ComparisonSessionSchema, ActivitySchema, CheckInSchema, ReviewSchema,
                   LeaderboardRowSchema, RecoComponentsSchema
src/requests.ts  — one schema per endpoint body/query: VenueSearchQuery, CreateEntryBody,
                   SubmitComparisonBody, CreateCheckInBody, UpdateCheckInBody, FollowBody,
                   WantToTryBody, UpdateMeBody, FeedQuery, LeaderboardQuery, UserSearchQuery
src/responses.ts — the response envelope per endpoint + a generic paginated<T>(item) helper
                   -> { items: T[], nextCursor: string | null }
src/errors.ts    — ApiErrorCode enum + ApiErrorSchema { error: { code, message, details? } }
src/index.ts     — barrel export

Use these EXACT field names:
VenueCard = { id, slug, name, neighborhood: string|null, city, lat, lng, photoUrl: string|null,
  distanceMeters: number|null,
  sports: { slug, name, colorHex, courtCount, surface: Surface|null }[],
  isIndoor, isFree, hasLights, requiresReservation,
  live: { activeCount, headcount, gameType: GameType|null, skillLevel: SkillLevel|null,
          lastCheckInAt: string } | null,
  myEntry: { rallyScore, rankPosition, totalRanked } | null,
  inWantToTry: boolean, cityElo: number,
  reco: { rallyScore, components: { personal: number|null, social: number|null, proximity: number|null,
          live: number|null, gate: number }, gateReason: string|null, why: string[] } | null }

ComparisonSession = { id, sportSlug, status, step, maxSteps, subject: VenueMini,
  nextPair: { opponentEntryId, opponent: VenueMini } | null,
  result: { entryId, rallyScore, rankPosition, totalRanked, sentiment, beat: VenueMini[] } | null }

Derive the rest from the Task 2 models — every field the UI needs and nothing it doesn't.
Timestamps are ISO strings on the wire, not Dates.

Also src/constants.ts:
  SENTIMENT_BANDS = { LIKED: [6.7, 10.0], FINE: [3.4, 6.6], DISLIKED: [0.0, 3.3] }
  MAX_COMPARISONS = 5
  CHECK_IN_TTL_MINUTES = 120
  IDEAL_COUNT: Record<SportSlug, number> = { basketball: 8, pickleball: 4, tennis: 4, soccer: 12,
    volleyball: 8, baseball: 12, softball: 12, running_track: 2, golf_range: 2, skate: 6,
    football: 12, handball: 4 }
  ELO_BASE = 1500, ELO_K = 32, ELO_SHRINK_C = 8

Verify: `pnpm --filter shared typecheck` passes and a scratch file can
`import { VenueCardSchema } from '@rally/shared'`.
```

**Verify:** typecheck clean.
**Commit:** `feat(shared): zod api contract`
🔀 **MERGE POINT 1 — the contract is frozen.** Person B now builds UI against mocks derived from these schemas; Person A implements the real endpoints. Any change to `packages/shared` from here is a two-person conversation, not a solo commit.
