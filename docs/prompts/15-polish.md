# Task 15 — Polish, states, a11y, performance

```text
Full polish pass. Be systematic — walk every route and every state.

1. LOADING: a skeleton for every async surface. Zero spinners. Zero layout shift when data lands
   (skeletons must match final dimensions).
2. EMPTY: every list — feed, ranked list, want-to-try, reviews, search, map results, leaderboard,
   check-in history. Each gets an icon, a headline, one line of body, and a CTA that actually goes
   somewhere useful. Write real copy, not "No items found."
3. ERROR: an error.tsx per route group with a Retry. A global not-found.tsx. Toast (sonner) on every
   mutation failure with a human message derived from the ApiError code — never a raw 500 string.
4. OFFLINE / SLOW: TanStack retry (2, exponential). An offline banner via navigator.onLine.
5. RESPONSIVE: verify 390 / 768 / 1024 / 1440. The desktop map home must be a real two-column layout,
   not a stretched phone. Test the bottom sheet at a real phone viewport.
6. A11Y: focus-visible rings everywhere; aria-labels on all icon buttons; ComparisonCard fully
   keyboard-operable; prefers-reduced-motion disables the count-up and the live pulse; contrast >= 4.5:1
   on all text (check the score colors against the dark background).
7. PERF:
   - next/image for every venue photo with sizes, priority on the hero.
   - Dynamic-import mapbox-gl (~800KB) with a skeleton fallback.
   - Verify no N+1 on the API for the map home (Prisma query log, <= 6 for 50 venues).
   - Lighthouse on / and /venue/[id]: performance >= 85, a11y >= 95. Report the numbers.
8. META: title/description per route; an OG image for venue pages (next/og — venue name + score + sport
   accent); favicon; apple-touch-icon; manifest.json (standalone, theme #0A0A0B) so it installs as a PWA.
9. COPY PASS: read every string aloud. Kill placeholder text, Lorem, "TODO", and any engineer-voice
   string. Sports slang where natural ("runs", "pickup", "open gym") — this app should sound like a
   player wrote it, not a PM.
10. Remove /styleguide from the production build (keep it behind NODE_ENV !== 'production').

Verify: paste the Lighthouse scores for / and /venue/[id]. Screenshot every empty state. Confirm zero
console errors and zero hydration warnings across all routes.
```

**Verify:** clean console; Lighthouse ≥85 / ≥95.
**Commit:** `polish: states, a11y, perf, copy`
