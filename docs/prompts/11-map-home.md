# Task 11 — Map home

```text
Build the map home at apps/web/app/(app)/page.tsx — the app's front door and the first thing a judge sees.

Layout:
- Mobile: full-bleed Mapbox canvas + a draggable bottom sheet (vaul) with three snap points
  (peek 12% / half 55% / full 92%). Sheet content = the ranked VenueCard list.
- Desktop >=1024px: two columns — map left (flex-1), scrollable list right (max-w-[440px]), no sheet.
  Same components, different shell.

Components:
- MapCanvas (react-map-gl): style mapbox://styles/mapbox/navigation-night-v1, initial view = the user's
  geolocation or Chicago (41.8781, -87.6298) at zoom 12. Supercluster for clustering. MapPins colored by
  the venue's primary sport, live pulse ring when live.activeCount > 0.
  Selecting a pin: fly to it, snap the sheet to half, scroll the list to that card, highlight it.
  Selecting a card: fly the map to that pin. Bidirectional — both directions must work.
- SportFilterBar: horizontally scrollable sport chips, single-select, defaulting to the user's primary
  sport. Sticky at the top over the map.
- FilterSheet: radius slider (1-15km), toggles for Indoor / Free / Has lights / Playable now, Reset.
  Active-filter count badge on the trigger.
- VenueList: ordered by reco.rallyScore desc. Each VenueCard shows the score + a RecoWhyChip rendering
  reco.why[0]. Skeletons while loading. EmptyState with a "widen the radius" CTA when empty.
- "Playable now" toggle: prominent, NOT buried in the filter sheet — it's a headline differentiator, so
  put it in the top bar. When on, show a count: "4 courts live now".

Data: TanStack Query. GET /api/feed/recommended?lat&lng&sport&radius&playableNow.
staleTime 30s; refetchInterval 60s ONLY when playableNow is on (liveness must feel live);
refetchOnWindowFocus true.
Geolocation: request on mount; on denial fall back to homeLat/homeLng, then to the Chicago centroid, and
show a small "Using your home area" note. NEVER block the map on a permission prompt.

URL state: sport, radius, and filters live in searchParams so the view is shareable and Back works.

Verify: run against the seeded DB with NEXT_PUBLIC_USE_MOCKS=false. Show me: clustered pins, 2+ pins
pulsing live, the sheet listing venues ordered by score with why-chips, and the playable-now filter
changing the result set. Screenshot mobile and desktop.
```

**Verify:** a live pulse is visible on load.
**Commit:** `feat(web): map home with reco feed + live layer`
