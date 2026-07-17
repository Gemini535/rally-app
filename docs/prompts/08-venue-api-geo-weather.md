# Task 8 — Venue API + geo search + weather

```text
Implement the venue read APIs in apps/api.

--- services/geo.ts ---
searchVenues({ lat?, lng?, radiusMeters, sportSlugs?, isIndoor?, isFree?, hasLights?, q?, limit, cursor })
  - lat/lng given: prisma.$queryRaw with ST_DWithin(geom, ST_MakePoint(lng,lat)::geography, radius)
    + ST_Distance for distanceMeters, ordered by distance, LIMIT 200 max.
  - Else: ordered by name, filtered by city.
  - Filters applied in SQL. `q` -> case-insensitive ILIKE on name and neighborhood.
  - Return venue ids + distanceMeters; a second Prisma query hydrates relations. Comment explaining
    why the two-step exists (Prisma can't type the raw geo result's relations).

--- services/weather.ts ---
getWeather(lat, lng):
  - Geohash the point to 5 chars (write a tiny encoder, no dependency).
  - Check WeatherCache; if fetchedAt < 30 min old, return payload.
  - Else GET https://api.open-meteo.com/v1/forecast with
    latitude, longitude, current=temperature_2m,precipitation,wind_speed_10m,
    hourly=precipitation_probability, daily=sunset, timezone=America/Chicago, forecast_days=1.
  - Cache and return { tempC, precipProbabilityNext60, windKph, sunsetAt }.
  - On failure: return null and log a warning. NEVER let weather break a venue response.
playabilityGate(venue, weather, now): { multiplier: number, reason: string | null }
  - isIndoor -> { 1.0, null }
  - weather === null -> { 1.0, null }   // unknown != unplayable
  - precipProbabilityNext60 > 60 -> { 0.15, "Rain likely within the hour" }
  - tempC < 4 || tempC > 35 -> { 0.5, `${round(tempC)}°C — rough conditions` }
  - windKph > 40 -> { 0.6, "High winds" }
  - now > sunsetAt && !hasLights -> { 0.1, `No lights — sunset was ${time}` }
  - else { 1.0, null }
  First matching rule only, in that order.

--- services/venues.ts ---
toVenueCard(venue, { viewerId, distanceMeters, liveMap, myEntryMap, wantToTrySet })
  - Batch-load live status, my entries, and want-to-try for the WHOLE result set in 3 queries.
    NO N+1. Write it this way from the start.
getVenueDetail(id, viewerId) -> VenueDetail
  - friendEntries = entries by the viewer's followees, ordered by that followee's taste affinity desc.
  - cityStats = this venue's rank among all venues in the city for its primary sport by shrunkElo.

--- services/live.ts ---
getLiveStatus(venueId, sportSlug) -> LiveStatus
  - Active = endedAt IS NULL AND expiresAt > now(). Must use the checkins_live_idx partial index.
  - headcount = MAX(headcount) across active check-ins (people report the same crowd — do NOT SUM).
  - users[] names only the viewer's followees and self; everyone else is an anonymous count.
getLiveStatusBatch(venueIds[], sportSlug?) -> Map<venueId, LiveStatus>   // ONE grouped query
getNearbyLive(lat, lng, radius, sportSlug?) -> LiveStatus[]

--- routes/venues.ts ---
GET /api/venues             optionalAuth, validate(VenueSearchQuery) -> paginated VenueCard
GET /api/venues/:id         optionalAuth -> VenueDetail (includes weather + playability)
GET /api/venues/:id/live    -> LiveStatus
GET /api/venues/:id/reviews -> paginated Review
GET /api/sports             -> Sport[], Cache-Control: public, max-age=3600

In development only, validate every response against its shared Zod schema (a dev-only assertion helper)
so contract drift fails loudly and locally.

Verify with curl and show me the output:
  /api/venues?lat=41.9227&lng=-87.6978&radius=3000&sports=basketball
  /api/venues/<id>
  /api/venues/<id>/live
Then prove there's no N+1: log the Prisma query count for a 50-venue search — it must be <= 6.
```

**Verify:** ≤6 queries for 50 venues.
**Commit:** `feat(api): venue search, geo radius, live status, weather gate`
