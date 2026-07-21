# Task 10 — Design system + shared components

```text
Build Rally's design system and shared components in apps/web. Dark-first.

--- Providers (do this FIRST — nothing downstream works without it) ---
app/layout.tsx currently mounts only ThemeProvider. Tasks 11-14 all depend on TanStack Query and
Task 15 depends on sonner toasts, and no task in this sequence owns that wiring. Create
apps/web/lib/query.tsx exporting a 'use client' QueryProvider (QueryClient held in useState so it is
per-request; defaults staleTime 30s, retry 2, refetchOnWindowFocus true), then mount <QueryProvider>
and sonner's <Toaster /> inside ThemeProvider in the root layout.

--- App shell (build it NOW, not in Task 14) ---
Create apps/web/app/(app)/layout.tsx with the bottom tab bar (mobile) / left rail (desktop):
Map · Feed · [+ Log] · Leaderboard · Profile. Task 14 fills in the destinations; this task only needs
the shell to exist — because Tasks 11, 12 and 13 all build pages inside (app)/ and without it you
cannot click from map to venue to log flow, which is precisely the demo path.
Include a logout control (supabase.auth.signOut() then router.push('/login')). No task in the
sequence builds one, and a judge who taps "Try as Marcus" currently cannot switch to Priya without
manually clearing cookies.

--- Design tokens (tailwind.config.ts + app/globals.css) ---
- Dark by default via next-themes, no theme toggle (one less thing to break).
- Background layers: base #0A0A0B, surface #141416, elevated #1C1C20, border #27272A.
- Text: primary #FAFAFA, secondary #A1A1AA, tertiary #71717A.
- Sport accents driven by sports.colorHex: a <SportThemeProvider sport> that sets --sport-accent on a
  wrapper so any child can use bg-[var(--sport-accent)].
- Score color scale: >=8.5 emerald-400, 6.7-8.4 green-500, 3.4-6.6 amber-500, <3.4 zinc-500.
- Type: Inter (next/font). tabular-nums on ALL scores. Scores are the hero number — text-4xl
  font-semibold tracking-tight, and nothing else competes with them.
- Radius: 12px cards, 8px controls. Borders over shadows (shadows read poorly on dark).
- Mobile-first at 390px. Desktop >=1024px: a two-column app shell (persistent map left, scrollable
  content right, max-w-[440px] content column). Do NOT just center a phone layout.

--- Shared components (apps/web/components/) ---
ui/                   — shadcn primitives: button, card, sheet, drawer, dialog, tabs, badge, avatar,
                        skeleton, input, select, slider, toggle-group, sonner (toast), scroll-area
venue/VenueCard       — variants 'compact' (map sheet / search) and 'row' (leaderboard / list).
                        Photo, name, neighborhood, distance, sport chips, ScoreBadge, LiveBadge,
                        want-to-try heart. The whole card links to /venue/[id]; the heart is a nested
                        button with stopPropagation.
venue/ScoreBadge      — number + color scale + optional "#2 of 9" rank pill. tabular-nums.
venue/LiveBadge       — pulsing dot + "7 here now" + gameType chip. Pulse ONLY when activeCount > 0.
venue/SportChip       — sport-colored pill with a lucide icon.
venue/ConditionGrid   — icon grid: surface, lights, indoor/outdoor, free, reservation, parking,
                        restrooms, water. Unknown values render as a muted "—", NEVER as false.
                        (Absent data must not read as an absent amenity — that's a trust bug.)
ranking/ComparisonCard— two venue tiles side by side (stacked on mobile), each tappable, with
                        "Too close to call" beneath. Min 44px tap targets. Keyboard: Left/Right pick,
                        Space = too close. ProgressDots showing step/maxSteps.
ranking/ResultReveal  — animated count-up to rallyScore (~700ms, ease-out), then the "#2 of 9" pill
                        fading in, then the ranked list rendering with the new entry slotting into place.
                        This is one of exactly two animations in the app. Make it good — it's the
                        emotional payoff of the entire product and the moment the demo lands.
ranking/RankedList    — grouped by sentiment band with headers (Liked / Fine / Didn't like), a
                        band-colored left rule, rankPosition + ScoreBadge per row.
map/MapPin            — sport-colored circular pin, count badge, live pulse ring if occupied.
social/UserRow, social/UserAvatar, social/AffinityBadge ("82% taste match")
feed/ActivityCard     — one component switching on Activity.type.
shared/EmptyState     — icon + headline + body + optional CTA. EVERY list uses this.
shared/LoadingSkeleton— per-surface skeletons (VenueCardSkeleton, FeedSkeleton, ListSkeleton).
                        No spinners anywhere in the app.

--- Mocks ---
apps/web/lib/mocks/ — realistic fixtures for every shared Zod schema (use the schemas as the source of
truth; ~20 venues, 8 users, 15 activities, 3 comparison sessions). Wire api-client.ts to return mocks
when NEXT_PUBLIC_USE_MOCKS=true with a 200ms artificial delay so skeletons are visible. This lets the
frontend be built before the API exists — keep it working until Merge Point 2.

Build a /styleguide route (dev-only) rendering every component in every state (loading, empty, error,
populated). This is how we catch broken states before a judge does.

Verify: `pnpm --filter web dev`, open /styleguide, screenshot it. Every component in every state.
```

**Verify:** /styleguide complete.
**Commit:** `feat(web): design system + shared components + mocks`
