# Task 12 — Venue detail + check-in

```text
Build apps/web/app/(app)/venue/[id]/page.tsx. An RSC shell fetching VenueDetail server-side (fast first
paint, good OG tags), with client components for the interactive parts.

Two corrections before you build:
- ReviewList (section 7): nothing in Tasks 9-14 ever creates a review, so this section can only render
  its EmptyState, forever. Either cut it, or source it from entries with a non-null note for this
  venue (the note captured in Task 13) and title it "Notes from players". Do not ship a permanently
  empty section.
- PlayabilityBanner: services/weather.ts and playabilityGate are already implemented and return
  { multiplier, reason } with reason: string | null. Render from that exact shape; do not invent a
  new one or re-fetch Open-Meteo from the client.

Sections, in this order (the order is the argument the page makes):
1. VenueHero — photo with a bottom gradient, name, neighborhood, sport chips, distance, back button.
2. PlayabilityBanner — only when gateReason is non-null OR the venue is outdoor. Weather icon, temp, and
   the reason string ("Rain likely within the hour", "No lights — sunset was 8:24 PM"). Amber when
   gate < 1, subtle green ("Good conditions · 24°C") when clear. This banner is a differentiator — make
   it look considered, not like a debug string.
3. LivePanel — THE hero section for an occupied venue. Big headcount, pulsing indicator, gameType +
   skillLevel chips, an avatar stack of followees present, the latest note in quotes, relative time
   ("updated 12 min ago"). When empty: a muted "No one checked in right now · Be the first" with a
   Check In CTA. Polls every 45s.
4. ScoreTriad — three columns: YOUR SCORE (or "Not ranked yet"), FRIENDS (affinity-weighted avg + count),
   CITY (#rank of N by shrunkElo). Big tabular numbers.
5. ConditionGrid — per sport, tabbed if the venue hosts multiple.
6. FriendRankingsList — followees who ranked it, ordered by taste affinity desc. Each row: avatar, name,
   AffinityBadge, their score, their rank ("#2 of 11"), their note. This section is the whole social
   thesis in one screen — give it room.
7. ReviewList — paginated, EmptyState if none.
8. ActionBar — sticky bottom (mobile) / inline (desktop): [Log a visit] primary, [Check in] / [Check out]
   secondary (state from GET /api/check-ins/active), [heart] want-to-try toggle, [share] copies the URL
   and toasts.

CheckInDialog (shadcn Dialog):
  - Sport selector (only if multi-sport), headcount stepper (1-30, defaulting to IDEAL_COUNT[sport]),
    GameType toggle-group, SkillLevel toggle-group (defaulting to the user's skill for that sport),
    optional note (80 chars, placeholder "full court running, need 2").
  - On submit: POST /api/check-ins, optimistic LivePanel update, toast "Checked in — expires in 2 hours",
    invalidate the venue + feed queries.
  - If already checked in elsewhere, warn: "This will end your check-in at <venue>".

Want-to-try: optimistic toggle with rollback on error.

Verify: check in from the UI and show the headcount incrementing on both the venue page and the map's
live layer within one refetch. Screenshot a venue with friends' rankings and a live panel.
```

**Verify:** a check-in propagates to the map.
**Commit:** `feat(web): venue detail, live panel, check-in flow`
