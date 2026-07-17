# Task 17 (if time) — Stretch

Only start this once the MVP is demo-green and deployed. Pick ONE, finish it completely — a half-built stretch feature reads as "ran out of time," not "scoped well."

```text
Pick from these ONLY if the MVP is demo-green and deployed. In priority order — stop when time runs out.

A. RALLY UP (~3h, highest value): POST /api/rallies { venueId, sportSlug, startsAt, playersNeeded,
   gameType, skillLevel, note } + RSVP endpoints. A RallyCard on the venue page and in the feed with an
   RSVP button and a "3 of 8 in" progress bar. Converts Rally from discovery to coordination and is the
   most compelling roadmap slide.
B. Photo upload (~2h): a Supabase Storage bucket "venue-photos", signed client upload, client-side
   compression (browser-image-compression) to < 500KB, append to the venue's photos.
C. Community condition edits (~2h): PATCH /api/venues/:id/conditions + an edit-log table + an
   "updated by @dev 2d ago" attribution line on ConditionGrid.
D. Popular times (~2h): aggregate historical check-ins by (venue, sport, day-of-week, hour) into a
   sparkline on the venue page. The seed data already supports this — ~40 lines and it looks great.
E. Affinity explainer modal (~1h): tap the AffinityBadge -> a scatter of your rank vs. theirs across
   shared venues, with the tau value. Cheap, and technical judges love it.

Do ONE. Finish it completely.
```
