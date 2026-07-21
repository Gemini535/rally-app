# Task 13 — Log & comparison flow (the money screen)

This is the single most important screen in the product. Time-box polish here generously — this is what the demo hinges on.

```text
Build apps/web/app/(app)/log/[venueId]/page.tsx — the Beli-style ranking flow. This is the single most
important screen in the product. It must feel fast, obvious, and satisfying. Every tap under 100ms
perceived. No layout shift between comparisons.

Contract preconditions — verify all three before writing the state machine:
- POST /api/comparisons takes { sessionId, winnerEntryId }. The committed SubmitComparisonBody has
  opponentEntryId and no sessionId; Task 9 is supposed to add it. Confirm it landed.
- The DETAILS step PATCHes the entry. Task 9 adds UpdateEntryBody and PATCH /api/entries/:id.
  Confirm both exist. If the PATCH was skipped, do NOT drop the note and tags — CreateEntryBody
  already carries both, so instead move DETAILS to be the FIRST step and send them on the initial
  POST /api/entries.
- CreateEntryBody requires playedAt (ISO datetime). The SENTIMENT screen never asks for a date, so
  default it to new Date().toISOString() at submit time or the POST fails validation.

A client-side state machine (useReducer, explicit states — do NOT do this with a pile of booleans):
  SENTIMENT -> COMPARING -> DETAILS -> REVEAL -> done

1. SENTIMENT: "How was <Venue>?" Three large stacked buttons with sport-accent theming:
   "Liked it" / "It was fine" / "Didn't like it". Each shows how many venues are already in that band
   ("You've liked 5 basketball courts"). Sport preselected if the venue has one; chip picker if not.
   On tap: POST /api/entries -> { entry, session }.
   If session.result is already present (empty band), skip straight to DETAILS.

2. COMPARING: render ComparisonCard for session.nextPair.
   "Which do you like better?" — subject vs. opponent, side by side (stacked on mobile with a "vs" divider).
   ProgressDots showing step/maxSteps.
   On tap: POST /api/comparisons { sessionId, winnerEntryId } -> render the next pair.
   "Too close to call" sends winnerEntryId: null.
   There is nothing to prefetch (the server picks the pair) — instead show an optimistic 200ms crossfade
   so it never feels like a network wait. On failure, restore the pair and toast.
   Keyboard: ArrowLeft/ArrowRight select, Space = too close. Show the hints on desktop.
   A "Skip ranking" escape hatch calls the abandon endpoint.

3. DETAILS: optional note (140 chars) + TagPicker with per-sport suggestions (basketball: "good runs",
   "true rims", "well lit", "gets packed", "no nets"; tennis: "fast surface", "windy", "backboard";
   pickleball: "dedicated courts", "lines taped", "paddle rack"). Skippable.
   On submit: PATCH the entry, go to REVEAL.

4. REVEAL: ResultReveal.
   - The score counts up from 0.0 to the final rallyScore over ~700ms, ease-out, tabular-nums, colored
     by the score scale.
   - Then "#2 of 9 basketball courts" fades in.
   - Then the user's ranked list renders with the new entry highlighted and slotting into position.
   - "You ranked it above <Venue A> and <Venue B>" using result.beat.
   - CTAs: [Check in here] · [Back to map] · [View my list]
   - Confetti (canvas-confetti) ONLY for a new #1. Restraint: it should mean something.

Data: TanStack Query mutations. On completion invalidate ['me','list'], ['feed'], ['venue', id].
Handle: session already DONE -> redirect to the venue with a toast. Session not owned -> 403 -> redirect.
Back button mid-flow -> a confirm dialog ("Your ranking isn't saved yet").

Verify: log a venue end to end on the seeded Marcus account and screen-record it. It must take under
15 seconds from tap to reveal. Show the list updating.
```

**Verify:** under 15 seconds, tap to reveal.
**Commit:** `feat(web): log + pairwise comparison flow with score reveal`
