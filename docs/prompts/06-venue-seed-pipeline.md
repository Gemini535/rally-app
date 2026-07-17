# Task 6 — Venue seed pipeline

```text
Build the venue seed pipeline in scripts/.

--- scripts/overpass-fetch.ts ---
POST the Overpass QL query below to https://overpass-api.de/api/interpreter (form-encoded, `data=`),
with 3 retries and exponential backoff. Write the raw JSON to scripts/data/chicago-venues.raw.json.
ALSO produce scripts/data/chicago-neighborhoods.geojson (Chicago community areas) — if fetching it is
awkward, accept a committed file and tell me exactly where to download it.
COMMIT BOTH OUTPUT FILES — the build must never depend on Overpass being reachable at demo time.

Query:
[out:json][timeout:120];
(
  nwr["leisure"="pitch"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["leisure"="track"]["sport"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["leisure"="sports_centre"]["sport"](41.6445,-87.9401,42.0230,-87.5237);
  nwr["sport"~"^(basketball|tennis|soccer|volleyball|baseball|softball|running|pickleball|skateboard|american_football|handball)$"](41.6445,-87.9401,42.0230,-87.5237);
);
out center tags;

--- scripts/normalize-venues.ts ---
Read the raw JSON, emit scripts/data/chicago-venues.normalized.json shaped as
{ osmId, name, slug, lat, lng, neighborhood, address, isIndoor, isFree, requiresReservation,
  hasLights, hasParking, hasRestrooms, hasWater, photoUrl,
  sports: [{ slug, courtCount, surface, isLit }] }[]

Rules, in this order:
1. Coordinates: node -> lat/lon; way/relation -> center.lat/lon. Drop elements with neither.
2. sport tag: split on ";" -> multiple sports. Map american_football->football, running->running_track,
   skateboard->skate. Drop values outside our SportSlug enum.
3. Drop access=private|customers. fee=yes -> isFree=false. reservation=required|yes -> requiresReservation.
4. Name: use `name`; if absent, find the nearest element with leisure=park within 250m in the same raw
   payload and synthesize "<Park Name> — <Sport> Courts". If still unnamed, DROP the venue.
5. surface: asphalt->ASPHALT, concrete->CONCRETE, clay->CLAY, grass->GRASS,
   artificial_turf|synthetic->TURF, wood|hardwood->HARDWOOD, tartan|rubber->RUBBER, sand->SAND;
   missing -> infer from sport + isIndoor (indoor->HARDWOOD, basketball outdoor->ASPHALT,
   tennis->ASPHALT, soccer->GRASS, running_track->RUBBER, volleyball outdoor->SAND).
6. lit=yes -> hasLights. indoor=yes OR leisure=sports_centre -> isIndoor.
7. hoops|courts|lanes -> courtCount (parseInt, default 1).
8. Dedupe: cluster venues within 40m sharing a sport; keep the one with the most tags; merge sport lists.
9. neighborhood: point-in-polygon against chicago-neighborhoods.geojson
   (use @turf/boolean-point-in-polygon).
10. Cap 30 venues per sport: sort by tag-completeness desc, then greedily select for geographic spread
    (farthest-point sampling) so the map isn't one dense cluster. Target ~180 venues total,
    all 12 sports represented.
11. photoUrl: assign deterministically from a per-sport list in scripts/data/photos.ts via
    hash(osmId) % list.length. Create that file with 2-3 LOCAL paths per sport
    (/seed-photos/basketball-01.jpg etc.), and create apps/web/public/seed-photos/README.md telling me
    exactly which filenames to drop in. Do NOT hotlink a remote image host.
12. slug: kebab-case(name + "-" + primary sport), deduped with a numeric suffix.

Print a summary table: venues per sport, venues per neighborhood, % with surface, % with lights,
and the count dropped at each filter step.

Verify: `pnpm seed:venues:fetch && pnpm seed:venues:normalize` produces 150-220 venues across
12 sports and >= 15 neighborhoods. Show me the summary table.
```

**Verify:** the summary table looks like a real city, not 180 courts in one neighborhood.
**Commit:** `feat(seed): overpass fetch + venue normalization`
