# whereis — Decisions log

Architectural decisions and why-not-X. Append-only — when reversing a decision, add a new entry rather than editing the old one.

---

## D-001 · Auth via Traccar session cookie, no separate JWT

**Decided:** Build time
**Context:** App has its own backend (Bun) alongside the Traccar server. Could have introduced its own JWT/session layer.
**Decision:** Use Traccar's `JSESSIONID` cookie as the single source of truth. Frontend sends `credentials: 'include'` on every API call. Bun backend verifies identity by forwarding the cookie to `GET /api/session`.
**Why:** Avoids two parallel auth systems. Traccar already manages users; duplicating that in our backend would be busywork.
**Trade-off:** Backend is dependent on Traccar being reachable to verify any request. Acceptable since they're both in the same Docker network.

## D-002 · Bun (not Node) for backend

**Decided:** Build time
**Context:** Need a small HTTP server for invite/webhook/admin logic.
**Decision:** Bun + `bun:sqlite`.
**Why:** Native TypeScript, native SQLite, single binary, fast startup. The logic is small enough that ecosystem maturity doesn't matter.
**Trade-off:** Less mature than Node. Lock file (`bun.lockb`) needs to be generated in Docker or CI since `bun` isn't always on the dev machine.

## D-003 · Traccar's hosted Nominatim geocoder

**Decided:** Build time
**Context:** Reverse-geocoding for displaying place names. Could have used MapTiler, Google, or self-hosted.
**Decision:** Use `geocoder.traccar.org` — Traccar's hosted Nominatim.
**Why:** No API key, no billing surface, no rate-limit signup. Good enough for a small private group.
**Trade-off:** Quality is variable. If users complain about wrong addresses, swap to a paid geocoder.

## D-004 · ntfy.sh for push notifications, not native APNs/FCM

**Decided:** Build time
**Context:** Need to notify users of events (member entered geofence, started moving, etc.).
**Decision:** Traccar webhook → Bun backend → `POST https://ntfy.sh/{topic}`. Users subscribe to their topic in the ntfy mobile app.
**Why:** No app-store distribution needed. No service worker complexity. Works on iOS without a native build.
**Trade-off:** Users must install ntfy app separately. Topic strings need to be private (treated as bearer tokens).

## D-005 · Pause = `device.disabled = true` server-side

**Decided:** Build time
**Context:** "Pause sharing" needs to actually stop sharing, not just hide locally.
**Decision:** Bun backend sets `device.disabled = true` in Traccar via the admin API. Traccar stops accepting positions for that device.
**Why:** Client-side pause is trivially bypassable (anyone with the link could see the position). Server-side is genuine.
**Trade-off:** Requires admin credentials in the backend. Backend is now a privileged service — guard it accordingly.

## D-006 · Bun backend holds admin credentials

**Decided:** Build time
**Context:** Some operations (disable device, remove member, share permissions) require Traccar admin access.
**Decision:** Bun backend is the ONLY service with admin credentials. All admin-requiring frontend actions go through `/backend/`.
**Why:** Avoids leaking admin auth to the browser. Centralises admin operations.
**Trade-off:** Backend is a higher-value attack target. Mitigate by ensuring it's only reachable via nginx, not exposed directly.

## D-007 · MapLibre + OpenFreeMap, not MapTiler/Mapbox

**Decided:** Build time
**Context:** Need vector tiles and a map renderer.
**Decision:** MapLibre GL JS + OpenFreeMap tiles.
**Why:** Both are free, no API key, no usage limits for personal projects.
**Trade-off:** Attribution is required (currently missing — see known gaps). OpenFreeMap quality is fine but not Google-level.

## D-008 · Single MapLibre instance for live map only

**Decided:** Build time
**Reversed:** Partially — see below
**Context:** History and geofences also need to display map content.
**Decision (original):** All map views share a singleton `mapInstance` exported from `useMapInstance.ts`. History and geofences would render as modes within `/map` rather than separate pages.
**Decision (current):** Pragmatic — History and Geofences create their own MapLibre instances because separating modes within `/map` got too complex.
**Why reversed:** Speed of delivery. Refactoring to a single shared instance is listed in known gaps for future work.
**Trade-off:** Higher memory footprint when switching between live/history/geofences. Acceptable for now.

## D-009 · Zustand for state, not Redux or Context

**Decided:** Build time
**Context:** Need per-feature stores (map positions, friends list) plus app-wide auth.
**Decision:** Zustand. One store per feature (`features/X/store.ts`) plus two global stores (`auth`, `socket`).
**Why:** Smaller API than Redux, no provider wrapping, hooks-first. Per-feature stores keep concerns localised.
**Trade-off:** No built-in devtools as rich as Redux's. Acceptable given the scope.

## D-010 · Dark theme always — no light mode

**Decided:** Build time
**Context:** Most location-sharing apps offer light/dark themes.
**Decision:** Dark only. `dark` class on `<html>` directly, no toggle.
**Why:** Solo developer + small group of users — light mode would be ~20% more design work and zero asked for it.
**Trade-off:** Reduces user choice. Reversible — add a theme toggle if anyone asks.
