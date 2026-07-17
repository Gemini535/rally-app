# Task 14 — Feed, profiles, leaderboard, search, onboarding

```text
Build the remaining screens.

--- /feed ---
Infinite-scroll social feed (TanStack useInfiniteQuery, cursor pagination).
ActivityCard variants:
  RANKED_VENUE: "<Marcus> ranked <Wicker Park> #2 of 9 · 8.7" — avatar, venue thumb, ScoreBadge,
                rank pill, their note, relative time.
  CHECKED_IN:   "<Priya> is at <Gill Park> · 5 here · casual", with a live pulse if still active and a
                "Join" button linking to the venue. THIS CARD IS THE PRODUCT — style it as the most
                alive thing in the feed.
  WANT_TO_TRY / FOLLOWED / REVIEWED: compact one-liners.
EmptyState when following nobody: "Your feed is quiet" + a suggested-users list (demo users with the most
rankings) with inline Follow buttons.
Pull-to-refresh on mobile; refetch on focus.

--- /me and /u/[handle] ---
ProfileHeader: avatar, displayName, @handle, bio, home neighborhood, counts (ranked / followers /
  following), sport chips with skill level.
SportTabs -> RankedList grouped by sentiment band.
/me also: WantToTryList tab, CheckInHistory tab.
/u/[handle] also: FollowButton (optimistic), AffinityBadge per shared sport ("82% taste match in
  basketball · 7 courts in common"), SharedVenuesStrip (venues both ranked, showing both scores side by
  side — this makes affinity legible instead of magical).
EmptyStates for every tab.

--- /leaderboard ---
SportTabs + ScopeToggle (Global / Friends) + a disabled CityPicker showing "Chicago" (signals multi-city
extensibility without building it).
LeaderboardRow: big rank number, venue photo, name, neighborhood, shrunkElo, nEntries, avgRallyScore, and
the viewer's own rank for that venue as a small chip if they've ranked it ("you: #2"). That
personal-vs-crowd contrast is a great detail.
A one-line explainer under the header: "Ranked by head-to-head record across N comparisons", with an info
tooltip explaining Elo + shrinkage in two sentences. Judges will read this.

--- /search ---
Debounced (250ms) input, TabSwitch (Venues / People). Venues -> GET /api/venues?q=, People ->
GET /api/users/search?q=. Recent searches in localStorage. EmptyState per tab.

--- /onboarding ---
4 steps with a progress bar:
1. "What do you play?" — sport chips, multi-select, min 1. First one marked primary.
2. "How do you play?" — per selected sport: SkillLevel toggle + preferred GameTypes.
3. "Where do you play?" — "Use my location" or a Chicago neighborhood picker. Sets homeLat/homeLng.
4. "Rank 3 places you've played" — venue search scoped to their sports and near their home, showing
   venue cards. Selecting one runs the REAL /log flow inline (reuse the Task 13 components, do not fork
   them). Progress "2 of 3". Skippable after 1 — but push for 3, because a 3-venue list makes every
   subsequent recommendation good, and this is where a cold-start app usually dies.
On finish: PATCH /me, route to /.

--- App shell ---
Bottom tab bar (mobile) / left rail (desktop): Map · Feed · [+ Log] · Leaderboard · Profile.
The center Log button is a sport-accent FAB opening a venue picker.
Active states, safe-area insets, no layout shift on route change.

Verify: click through every route on the seeded Marcus account. Screenshot each. No empty screens, no
console errors, no 404s.
```

**Verify:** every route populated.
**Commit:** `feat(web): feed, profiles, leaderboard, search, onboarding`
