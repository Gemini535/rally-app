# Task 4 — Ranking engine (pure, tested)

This is the highest-value test suite in the repo. Do not skip it.

```text
Implement Rally's ranking engine in apps/api/src/services/ranking/. Write the pure math as PURE
FUNCTIONS with zero DB access in core.ts, and the DB orchestration separately in service.ts.
This separation is required — core.ts must be unit-testable with no database.

--- core.ts (pure) ---
export function maxSteps(bandSize: number): number
  = min(MAX_COMPARISONS, ceil(log2(bandSize + 1)))   // 0 -> 0, 1 -> 1, 3 -> 2, 15 -> 4, 31+ -> 5
export function nextComparisonIndex(lo, hi): number | null = lo < hi ? floor((lo + hi) / 2) : null
export function applyComparisonResult(lo, hi, mid, subjectWon: boolean): { lo, hi }
  subjectWon -> { lo, hi: mid };  else -> { lo: mid + 1, hi }
  // "too close to call" is passed as subjectWon = false by the caller
export function resolveInsertIndex(lo, hi, stepsTaken, maxSteps): number
  = lo >= hi ? lo : floor((lo + hi) / 2)   // the cap truncated the search: split remaining uncertainty
export function scoreBand(sentiment, bandSizeAfterInsert: number, positionInBand1Based: number): number
  const [loS, hiS] = SENTIMENT_BANDS[sentiment]
  m === 1 ? (loS + hiS) / 2 : hiS - (p - 1) * (hiS - loS) / (m - 1)   // round to 1 decimal
export function rescoreBand(sentiment, orderedEntryIds: string[]): { entryId, rallyScore }[]
export function globalPositions(bands: { LIKED: string[], FINE: string[], DISLIKED: string[] }):
  { entryId, rankPosition }[]    // concat LIKED ++ FINE ++ DISLIKED, rankPosition = 1..N
export function expectedScore(ra, rb): number       // 1 / (1 + 10^((rb - ra) / 400))
export function kFactor(nComparisons): number       // <10 -> 32, <40 -> 19.2, else -> 9.6
export function eloUpdate(ra, rb, nA, nB, aWon: boolean): { ra: number, rb: number }
export function shrunkElo(elo, nComparisons): number  // 1500 + (elo-1500) * n / (n + ELO_SHRINK_C)
export function kendallTau(ranksA: number[], ranksB: number[]): number   // tau-b
export function tasteAffinity(tau, overlapN): number
  // tauShrunk = tau * k/(k+3); affinity = clamp((tauShrunk + 1)/2, 0, 1); k < 3 -> 0.5

--- service.ts (DB) ---
export async function createEntryAndSession(userId, venueId, sportSlug, sentiment, note?, tags?, playedAt?)
  - If an entry already exists for (user, venue, sport): reuse it, set status=RANKING, update sentiment,
    null out rallyScore/rankPosition, and EXCLUDE it from its own comparison band.
  - Load the band = the user's RANKED entries for this sport with this sentiment, ordered by rankPosition asc.
  - Create ComparisonSession { lo: 0, hi: band.length, step: 0, maxSteps: maxSteps(band.length) }.
  - If maxSteps === 0, finalize immediately.
  - Return { entry, session } shaped as ComparisonSessionSchema.

export async function submitComparison(userId, sessionId, winnerEntryId: string | null)
  Inside ONE prisma.$transaction:
  1. Load + authorize the session (must be ACTIVE and owned by userId). 409 CONFLICT otherwise.
  2. Recompute the band; mid = nextComparisonIndex(lo, hi). Write a Comparison row
     (subjectEntryId, opponentEntryId = band[mid].id, winnerEntryId, positionIndex = mid).
  3. subjectWon = winnerEntryId === subject.entryId.
  4. Elo: SKIP ENTIRELY if winnerEntryId is null (tie). Otherwise upsert both VenueSportRating rows,
     apply eloUpdate, increment nComparisons on both.
  5. { lo, hi } = applyComparisonResult(...); step++.
  6. If lo < hi and step < maxSteps: persist and return { nextPair }.
  7. Else FINALIZE:
     - insertIndex = resolveInsertIndex(lo, hi, step, maxSteps)
     - splice the subject into the band; rescoreBand for that band; globalPositions across all 3 bands
     - bulk-update entries (rallyScore, rankPosition, status=RANKED); session.status = DONE
     - recompute VenueSportRating.avgRallyScore + nEntries for the subject venue
     - insert an Activity row (RANKED_VENUE) with payload { rallyScore, rankPosition, totalRanked }
     - recompute TasteAffinity between this user and everyone with a follow edge to/from them,
       for this sport (extract to affinity.ts)
     - return { result: { entryId, rallyScore, rankPosition, totalRanked, sentiment, beat } }
       where `beat` = up to 3 VenueMinis the subject outranked in this session.

export async function abandonSession(userId, sessionId)   // finalize at the current lo
export async function getUserList(userId, sportSlug)      // RankedEntry[] + band counts; lazily sweep any
                                                          // RANKING entry older than 1h into the list
export async function deleteEntry(userId, entryId)        // remove, resequence, rescore band

--- affinity.ts ---
export async function recomputeAffinityFor(userId, sportSlug): Promise<void>
  For each user v with a follow edge to/from userId: find venues both ranked in this sport;
  k < 3 -> skip; else compute kendallTau over rankPositions and upsert TasteAffinity
  (store BOTH (a,b) and (b,a) orderings so lookups are single-key).

--- Tests: apps/api/src/services/ranking/core.test.ts (vitest) ---
Cover at minimum:
- maxSteps for bandSize 0,1,2,3,7,15,16,31,50
- a full binary insertion for a 7-item band: a subject that beats everything lands at index 0;
  loses everything -> index 7; a middle preference lands correctly
- scoreBand: 1 item -> midpoint; 5 LIKED items -> [10.0, 9.2, 8.4, 7.5, 6.7]; bands never overlap
- eloUpdate: equal ratings + win -> +K/2 for the winner, -K/2 for the loser;
  expectedScore(1500,1500) === 0.5; a 400-point gap -> expectedScore ~= 0.909
- shrunkElo pulls a 2-comparison outlier toward 1500 harder than a 50-comparison one
- kendallTau: identical -> 1; exactly reversed -> -1; a known 4-element case computed by hand
- tasteAffinity: k=2 -> 0.5 regardless of tau

Verify: `pnpm --filter api test` — all green. Print the test output.
```

**Verify:** every test green.
**Commit:** `feat(api): ranking engine + elo + kendall tau, fully tested`
