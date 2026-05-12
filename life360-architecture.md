# WhereIs? — Architecture Decisions
> A Cherry's Labs project. Self-hosted, React PWA, Traccar backend, CasaOS Docker deployment.

---

## 1. Tech Stack

| Decision | Choice |
|---|---|
| Framework | React + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| State management | Zustand (per-feature stores + 2 global: auth, socket) |

### Folder Structure (hybrid: layers inside features)
```
src/
├── features/
│   ├── map/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts
│   ├── friends/
│   ├── history/
│   ├── geofences/
│   ├── stats/
│   ├── notifications/
│   └── onboarding/
│       ├── components/  # WizardShell, StepDots, InstallStep, ConfigureStep, ConfirmStep
│       ├── hooks/       # useOnboardingState, useDevicePoller
│       ├── InviteLanding.tsx
│       └── Wizard.tsx
├── shared/
│   ├── components/      # Button, Modal, BottomSheet, DateRangePicker, etc.
│   ├── hooks/           # useWebSocket, useAuth, useNotifications
│   ├── lib/             # traccar.ts API client, utils
│   └── types/           # Traccar API response types
├── stores/              # auth.store.ts, socket.store.ts
└── routes/              # Page-level components + RequireAuth wrapper
```

### Notes
- Vite path aliases: `@/features/...`, `@/shared/...`
- Shared `traccar.ts` API client wraps fetch with `credentials: 'include'`
- ESLint + Prettier, no additional ceremony

---

## Login Page

**Route:** `/login` — full page, redirects to `/map` if already authenticated

### Form
```
┌─────────────────────────────────────┐
│  WhereIs?                           │
│                                     │
│  Email                              │
│  [___________________________]      │
│                                     │
│  Password                [Show]     │
│  [___________________________]      │
│                                     │
│              [ Sign In ]            │
└─────────────────────────────────────┘
```

| Decision | Choice |
|---|---|
| Fields | Email + password only |
| Forgot password | No — admin resets via Traccar admin UI directly |
| On success | Redirect to `/map` (or `?redirect=` param for mid-session re-auth) |
| On failure | Inline error: "Incorrect email or password" |
| Session expired | `<RequireAuth>` catches 401 → redirects to `/login?redirect=<current-path>` |

- No registration link — this page is for returning members only; new members always arrive via `/invite?token=`
- `POST /api/session { email, password }` — standard Traccar session endpoint

---

## 2. Auth Flow

| Decision | Choice |
|---|---|
| Auth method | Traccar cookie session (JSESSIONID) |
| All API calls | `credentials: 'include'` |
| Session check on load | `GET /api/session` → hydrates auth Zustand store |
| Route protection | `<RequireAuth>` wrapper component |
| Logout | `DELETE /api/session` |
| User model | Individual Traccar account per friend |
| Invite method | Token-based invite link |
| Token storage | SQLite via `bun:sqlite` on backend |
| Onboarding | Full wizard (account creation → app install → device setup → confirm reporting) |

### Invite Flow
```
Admin generates token → stored in SQLite (invite_tokens table)
Friend receives link:  /invite?token=abc123
Onboarding wizard:
  Step 1: Create account (POST /api/users to Traccar, UUID generated)
  Step 2: Choose colour
  Step 3: Install Traccar Client
  Step 4: Configure app (deep link / QR / manual)
  Step 5: Confirm device reporting → poll /api/positions
```

### SQLite Schema
```sql
invite_tokens(token, created_by, used_by, expires_at, used_at)
group_members(user_id, traccar_user_id, joined_at)
user_devices(user_id, uuid, traccar_device_id, created_at)
user_colours(user_id, colour_hex, assigned_at)
ntfy_topics(user_id, topic, enabled)
notification_prefs(user_id, event_type, scope, enabled)
-- scope: 'own' | 'anyone'
```

### Notes
- Requires a thin Bun backend for invite logic + Traccar admin API calls
- Backend holds elevated Traccar admin credentials, never exposed to frontend

---

## 3. Live Map

| Decision | Choice |
|---|---|
| Map library | MapLibre GL JS |
| Tile provider | OpenFreeMap (Liberty/Bright style) |
| Marker style | Initials avatar + car icon composite (plain HTML + CSS, no React portals) |
| Marker behaviour | Stationary → initials avatar circle · Moving → rotating car + inset initials |
| Speed/heading overlay | Speed badge below marker + heading arc as MapLibre symbol layer |
| Clustering | None — small private group, not needed |

### Map Instance
One MapLibre instance, initialised in the map feature and shared across history and geofences via a ref. History and geofences manipulate its layers/sources directly — they do not create their own map instances.

### WebSocket Architecture
```
GET /api/socket (Traccar WebSocket)
  ↓
useTraccarSocket hook (shared/hooks/)
  ↓
Parse position updates → dispatch to map store + friends store
  ↓
MapLibre GeoJSON source updated via setData() — no full re-render
```

### Notes
- Markers use `maplibregl.Marker` with a custom HTML element built as a plain template string — no React portal needed
- Initials and colour sourced from `user_colours` SQLite table via backend API
- `course` field (0–360°) from Traccar position drives CSS `rotate()` on car icon
- Only move markers that have changed (diff against current state)
- OpenFreeMap URL: `https://tiles.openfreemap.org/styles/liberty`

---

## 4. Friend List & Status Panel

| Decision | Choice |
|---|---|
| Desktop layout | Fixed sidebar, 280px |
| Mobile layout | Bottom sheet (snap: peek 80px → half → full) |
| Bottom sheet library | `vaul` |
| Offline threshold | 30 minutes since `lastUpdate` |
| Card content | Avatar, name, status, address, speed + road, battery %, last seen |
| Sort order | Moving → stationary online → offline |

### Friend Card
```
┌─────────────────────────────────┐
│ [pic] Name          🟢 Online   │
│       123 Main St, Suburb       │
│       72 km/h · Princes Hwy     │
│       🔋 84%  · Updated 2m ago  │
└─────────────────────────────────┘
```

### Online Logic
```ts
const isOnline = (lastUpdate: string) =>
  Date.now() - new Date(lastUpdate).getTime() < 30 * 60 * 1000
```

### Notes
- Address from Traccar `position.address` — requires geocoding configured (see Traccar Setup)
- Clicking a card → fly map to friend + open detail popover
- Data sources: `GET /api/devices` + `GET /api/positions` + WebSocket updates

---

## 5. Location History

| Decision | Choice |
|---|---|
| Date picker | Presets only: Today / Yesterday / Last 7 days (custom range deferred) |
| Polyline style | Single colour per friend (matches marker colour) |
| Polyline spec | 3px width, 0.8 opacity, dimmed when not selected |
| Trip click | Popover with start/end/duration/distance |

### Data Flow
```
User selects friend + date range
  ↓
GET /api/reports/trips?deviceId=&from=&to=    → trip segment list
GET /api/reports/route?deviceId=&from=&to=    → raw positions for polyline (lazy — only on trip select)
  ↓
MapLibre GeoJSON LineString per trip segment (on shared map instance)
Trip list in sidebar (scrollable)
Click segment → highlight on map + show popover
```

### Trip Popover
```
┌──────────────────────────────┐
│ Trip · Thu 8 May             │
│ 9:14 AM → 9:47 AM (33 min)  │
│ 18.4 km · Avg 45 km/h       │
│ From: 123 Main St            │
│ To:   456 Church Rd          │
└──────────────────────────────┘
```

### Notes
- History mode replaces live markers with static start/end pins
- "Exit history" button returns to live view

---

## 6. Driving Stats Dashboard

| Decision | Choice |
|---|---|
| Chart library | Recharts |
| Default view | Group overview (all friends, leaderboard-style) |
| Drill-down | Per-friend dashboard on click |
| Date range | Shared preset chips component (same as history) |

### Metrics (from API)
- `GET /api/reports/summary` → Distance · Time driven · Trips · Avg speed · Max speed
- `GET /api/reports/events` → Speeding · Geofence enter/exit · Ignition on/off · Overspeed count

### Chart Types
| Metric | Chart |
|---|---|
| Distance over time | BarChart (per day) |
| Trip count over time | BarChart |
| Recent events | List (enter/exit/speed, timestamped) |

### Per-Friend Layout
```
[Stat cards: distance / time / trips / max speed]
[Distance BarChart — last 7 days]
[Recent events list]
```

---

## 7. Geofence Manager

| Decision | Choice |
|---|---|
| Shape types | Circle only (polygon deferred — no real use case yet) |
| Drawing | Click map to set centre, radius slider or input |
| Alert config | Per-geofence (enter / exit / both) |

### Traccar Area Format
```
Circle:  "CIRCLE (lat lon, radius)"   ← plain template string, no library needed
```
No WKT conversion required — circles post directly as a formatted string.

### CRUD Flow
```
Draw shape on shared map instance → Name + alert config form
  ↓
POST /api/geofences  { name, area }
POST /api/notifications  (link event type to geofence + users)
  ↓
Render all geofences as MapLibre fill layers on app load
```

### Notes
- Geofence list in sidebar: click → highlight on map, edit name/alerts, delete
- Notification event types: `geofenceEnter`, `geofenceExit`

---

## 8. Notifications

| Decision | Choice |
|---|---|
| Delivery | ntfy.sh |
| Platform | Desktop + mobile via ntfy app |
| Triggered events | All Traccar events (speeding, ignition, geofence, low battery) |
| Event filtering | Per-user, per-event-type toggles in backend |

### Architecture
```
Traccar webhook → POST /webhook (thin Bun backend)
  ↓
Parse event type + deviceId → resolve to user(s)
  ↓
POST https://ntfy.sh/{user-topic}
```

### Frontend
- Settings panel: per-event toggles + ntfy topic field
- No service worker involvement — ntfy handles delivery via its own apps

---

## 9. Mobile Responsiveness

| Decision | Choice |
|---|---|
| Strategy | PWA via `vite-plugin-pwa` (Workbox) |
| Mobile layout | Fullscreen map, all UI overlaid |
| Offline support | App shell only (JS/CSS precached) |

### Mobile UI Layout
```
[Friend avatar strip — top right]
[Bottom sheet — peek state, active friend]
[FAB buttons — zoom to me, layers toggle]
```

### Offline Caching Strategy
| Asset | Strategy |
|---|---|
| App shell (JS/CSS) | Precached at SW install |
| Map tiles | Cache-first, long TTL |

### Notes
- Live position data is not cached — offline mode shows the app shell only
- Capacitor wrapper for app store distribution is a future option if needed

---

## 10. Hosting & Deployment

| Decision | Choice |
|---|---|
| Infrastructure | Self-hosted VM with CasaOS |
| Deployment | Docker Compose containers managed via CasaOS |
| Public access | Cloudflare Tunnel (no open ports, IP hidden) |
| Domain (dev) | `tracking.elphiene.com` |
| Domain (prod) | `cherryslabs.com` (future migration, DNS change only) |
| SSL | Automatic via Cloudflare |
| Routing | Nginx reverse proxy, single domain, path-based |

### Docker Services
```
cloudflared    → Cloudflare Tunnel outbound connector
nginx          → Reverse proxy
frontend       → nginx:alpine serving built React PWA static files
backend        → Bun API server + webhook receiver
traccar        → GPS tracking server (port 8082)
```

### Nginx Routing
```
tracking.elphiene.com/           → frontend container
tracking.elphiene.com/api/       → Traccar (port 8082)
tracking.elphiene.com/backend/   → thin Bun backend
tracking.elphiene.com/socket     → Traccar WebSocket
```

### Notes
- No CORS config needed — same domain, Nginx proxies everything
- `.env` per service in Docker Compose, never committed to git
- Traccar not yet set up — needs to be installed first
- Migrating to `cherryslabs.com` later = update Cloudflare DNS only

---

## 12. Permissions Model

| Decision | Choice |
|---|---|
| Visibility | Symmetric — all members see all members |
| History access | Full history visible to all members |
| Status states | Moving · Stationary · Offline (>30 min) · Paused |
| Pause mechanic | Server-side via Traccar device `disabled` flag — genuinely stops recording |
| Pause toggle location | Own friend card / bottom sheet only |
| Admin role | Visible in UI — one designated admin |
| Admin controls | Invite generation, member removal |
| Member controls | Leave group, pause/resume own tracking |
| Removal | Admin removes others · Members leave themselves |

### Pause Implementation
```
User taps pause on own card
  ↓
POST /backend/pause
  ↓
Backend: PUT /api/devices/{traccarDeviceId} { disabled: true }
  ↓
Traccar stops accepting + recording positions for that device
  ↓
UI shows "Paused" status on own card + confirms tracking not recorded
```
Unpausing reverses the call (`disabled: false`). Pause state derived live from Traccar device status — no extra SQLite column needed.

### Member Removal
```
Admin removes member  →  DELETE /backend/members/{userId}
  ↓
Backend: PUT /api/devices/{id} { disabled: true }  (stop tracking)
Backend: DELETE group_members row
  ↓
Member disappears from map + friend list immediately
```
Member self-removal follows the same path minus the admin check.

### SQLite Addition
```sql
-- Add role column to existing group_members table
group_members(user_id, traccar_user_id, role, joined_at)
-- role: 'admin' | 'member'
```

### New Backend Endpoints
```
POST   /backend/pause              → disable own device in Traccar
POST   /backend/resume             → re-enable own device in Traccar
DELETE /backend/members/{userId}   → admin only: remove member + disable device
POST   /backend/leave              → self-removal from group
```

### UI Implications
- Own friend card shows pause/resume toggle, others' cards do not
- Paused status displayed as distinct state (not same as offline)
- Admin badge visible on admin's card in friend list
- Admin sees "Manage Members" section (invite + remove) — planned in settings

---

## Backend Auth Strategy

The Bun backend exposes protected endpoints (`/backend/pause`, `/backend/leave`, `/backend/members`, etc.) that must verify the caller's identity without maintaining a separate session system.

**Strategy: forward the Traccar JSESSIONID cookie**

```
Frontend request → /backend/pause (with JSESSIONID cookie)
  ↓
Bun middleware: GET /api/session (forwarding cookie) → Traccar
  ↓
200 → extract userId, proceed   |   401 → return 401 to frontend
```

- No JWT, no separate auth system — Traccar is the source of truth
- Every protected `/backend/*` handler calls `GET /api/session` first to resolve the user
- Response cached per request (single call per incoming request, not per-handler)
- Admin-only endpoints additionally check `group_members.role === 'admin'` from SQLite

---

## Traccar Setup Notes

### Geocoding (traccar.xml)
Using Traccar's own hosted geocoder (OSM-based, Nominatim-compatible, no API key needed):
```xml
<entry key='geocoder.enable'>true</entry>
<entry key='geocoder.type'>nominatim</entry>
<entry key='geocoder.url'>https://geocoder.traccar.org/api/</entry>
```
If unreliable, swap `geocoder.url` to LocationIQ (requires free API key) — no other changes needed.

### Webhook Forwarding (traccar.xml)
Required for ntfy notifications — Traccar POSTs events to the Bun backend:
```xml
<entry key='event.forward.enable'>true</entry>
<entry key='event.forward.url'>http://backend:3000/webhook</entry>
```
Uses Docker internal hostname `backend` (same Compose network — no external request needed).

---

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_SERVER_URL=https://tracking.elphiene.com
```
Baked into the bundle at build time. Used in the onboarding deep link:
`traccar://connect?url=${VITE_SERVER_URL}/api&id={uuid}&period=60`

### Backend (`backend/.env`)
```
PORT=3000
DATABASE_PATH=/data/whereis.db

TRACCAR_URL=http://traccar:8082
TRACCAR_ADMIN_EMAIL=admin@whereis.local
TRACCAR_ADMIN_PASSWORD=...

NTFY_BASE_URL=https://ntfy.sh

PUBLIC_URL=https://tracking.elphiene.com
```
`PUBLIC_URL` used when constructing invite links: `${PUBLIC_URL}/invite?token=abc123`

### Cloudflared (`docker-compose.yml` or `cloudflared/.env`)
```
TUNNEL_TOKEN=...   # from Cloudflare Zero Trust dashboard
```

### Traccar
Configured via `traccar.xml` — not `.env`. See Traccar Setup Notes for geocoding + webhook entries.

### Nginx
No env vars — static config file only.

---

## Key Dependencies Summary

```
Core:         react, vite, typescript, zustand
UI:           tailwindcss, shadcn/ui, vaul
Map:          maplibre-gl
Charts:       recharts
Onboarding:   qrcode  (QR code generation, client-side)
PWA:          vite-plugin-pwa
HTTP:         native fetch (credentials: include)
Notifications: ntfy.sh (no npm lib — plain POST)
Backend:      bun, bun:sqlite
Infra:        docker, nginx, cloudflared, traccar
```

---

## 11. Onboarding Wizard

### Wizard Steps (5 total)
```
① Create Account → ② Choose Colour → ③ Install App → ④ Configure App → ⑤ Confirm Device
```

### Global Rules
- Progress indicator: horizontal step dots (active / complete / upcoming)
- Back button on every step (step 1 back → returns to landing page)
- Resume from last completed step via `localStorage` on browser close/reopen
- Account creation commits to Traccar immediately on step 1 submit

### localStorage State Shape
```ts
onboarding_state: {
  step: number,
  accountCreated: boolean,
  colourChosen: boolean,
  deviceConfigured: boolean,
  email: string   // for re-auth if session expires mid-wizard
}
```
Clear on wizard completion or manual restart.

### Invite Landing Page
- Token validated on load via `GET /backend/invite/:token`
- Valid: branded hero, inviter name + avatar from token response, single CTA
- Expired/used/invalid: dead end, no recovery path, request new invite from sender
- Already logged in: silent redirect to `/map`
- Token stored in `sessionStorage` to survive wizard navigation

### Step 1 — Account Creation
- Fields: display name, email, password (8+ chars, show/hide toggle)
- No username — email is the login key, display name is the map label
- Account POSTed to Traccar on submit; UUID generated + stored in SQLite; `POST /api/devices` to register device in Traccar before user opens app

### Step 2 — Colour Picker
- Auto-assigned from first unoccupied palette slot
- User can override from palette; occupied colours greyed out
- Stored in `user_colours` SQLite table; changeable later in settings

### Step 3 — Install App
- Standardised on **Traccar Client** only (no OwnTracks option presented)
- Platform auto-detected via user agent; manual override ("Wrong platform?")
- Desktop: both store links + QR codes side by side
- "I've installed it →" advances without programmatic verification

### Step 4 — Configure App
Config delivery priority:
1. Deep link: `traccar://connect?url=https://tracking.elphiene.com/api&id={uuid}&period=60`
2. QR code (client-side via `qrcode` npm, shown as fallback)
3. Manual copy fields behind "Need help?" accordion

Reporting frequency: 60 seconds (set via deep link `period` param, invisible to user).

### Step 5 — Confirm Device Reporting
- Poll `GET /api/positions` every 10s, timeout after 2 minutes (12 attempts)
- Match on `deviceId` + `fixTime` within last 5 minutes
- Waiting state: animated pulse rings around avatar
- Success: ring turns green, auto-advances to map
- Help state (timeout): common fixes list + "Redo device setup" + "Skip for now"

### "Skip for now" Path
- Marks onboarding complete in localStorage
- Persistent top banner on map: `⚠ Your device isn't sharing yet — Finish setup →`
- Banner reappears each session until device reports; resumes at step 4

### Error Handling
| Error | Behaviour |
|---|---|
| Duplicate email | Inline: "Account exists — sign in instead →" |
| Account creation 500 | Inline banner + retry |
| Device POST to Traccar fails | Block + retry |
| Device never reports | Skip allowed via "Skip for now" |
| Session expired mid-wizard | Modal re-login → restore from localStorage |
| Network offline | Inline banner, no action |

### Post-Onboarding
- Completion screen (auto-advances after 3s): avatar with chosen colour + member count
- First map load: fly to own position (zoom 15, 1.5s), own marker pulses once
- No coach marks

### Re-onboarding (Settings → Device & Tracking)
- Entry: Settings page → "Reconnect Device" button
- UUID always reused — one identifier per user, forever; new phone = same UUID, reconfigure app
- Re-onboarding is 3 steps (Install skippable), reuses `<InstallStep>`, `<ConfigureStep>`, `<ConfirmStep>` directly

### Component Reuse Map
| Component | Wizard | Re-onboarding |
|---|---|---|
| `<InstallStep>` | Step 3 | Step 1 (skippable) |
| `<ConfigureStep>` | Step 4 | Step 2 |
| `<ConfirmStep>` | Step 5 | Step 3 |
| `<StepDots>` | All steps | No |
| `<DeviceStatus>` | No | Settings panel |

### Folder Location
```
src/features/onboarding/
  components/   # WizardShell, StepDots, InstallStep, ConfigureStep, ConfirmStep
  hooks/        # useOnboardingState, useDevicePoller
  InviteLanding.tsx
  Wizard.tsx
```

---

## Build Order

1. Cloudflare Tunnel + Nginx + Docker Compose scaffold + domain setup
2. Traccar install + geocoding config
3. Thin Bun backend (invite system + `bun:sqlite` + Traccar admin API + ntfy webhook + pause/resume/removal endpoints)
4. React app shell (routing, auth store, RequireAuth, session hydration)
5. Settings page stub (route + layout + empty sections + back nav)
6. Live map + WebSocket + friend markers
7. Friend list sidebar + bottom sheet
8. Invite + onboarding flow
9. Settings: Account section
10. Settings: Appearance (colour picker)
11. Settings: Device & Tracking + reconnect flow
12. Location history
13. Geofence manager (circles)
14. Stats dashboard
15. Settings: Notifications (ntfy panel)
16. Settings: Admin section (invite generator + member list)
17. PWA config + offline app shell caching
18. Settings: Danger Zone

> **Note:** The deep link in onboarding step 4 hardcodes the server URL from an env variable (`VITE_SERVER_URL`). Migrating from `tracking.elphiene.com` to `cherryslabs.com` requires existing users to re-run device setup (step 4 onward). Plan the migration before onboarding real users.

---

## Settings Page

**Route:** `/settings` — full page replacement, consistent on all screen sizes  
**Structure:** Single scrollable page with anchor-linked section headings  
**Max content width:** 640px, centred  
**Back navigation:** "← Back to map" button top-left, all screen sizes

### Section Order
```
Account
Appearance
Device & Tracking
Notifications
Admin          ← role-gated, admin only
──────────────
Danger Zone
```

### Section Anchors
```
/settings#account
/settings#appearance
/settings#device
/settings#notifications
/settings#admin
/settings#danger
```
Used for direct linking from other UI — e.g. "Finish setup →" banner links to `/settings#device`.

---

### Account Section

```
┌─────────────────────────────────────┐
│  Account                            │
│                                     │
│  Display name                       │
│  [___________________________]      │
│                                     │
│  Email                              │
│  [___________________________]      │
│                                     │
│  Current password                   │
│  [___________________________]      │
│                                     │
│  New password (leave blank to keep) │
│  [___________________________]      │
│                                     │
│  Confirm new password               │
│  [___________________________]      │
│                                     │
│              [ Save Changes ]       │
└─────────────────────────────────────┘
```

```ts
PUT /api/users/{id} {
  name: displayName,
  email,
  ...(newPassword ? { password: newPassword } : {})
}
```

- Password fields only included in payload if non-empty; current password validated server-side before accepting new password
- Confirm password validated client-side before submit
- Display name change → bust initials/colour cache → markers re-render
- Email change → show warning: "You'll use this email to sign in next time"
- Password: show/hide toggle, 8+ char minimum (matches onboarding)
- Inline error banner on API failure, success toast on save

---

### Appearance Section

```
┌─────────────────────────────────────┐
│  Appearance                         │
│                                     │
│  Your colour                        │
│  How you appear on everyone's map   │
│                                     │
│  [A]  ○ ● ○ ○ ○ ○ ○ ○             │
│       (occupied colours greyed out) │
│                                     │
│              [ Save Colour ]        │
└─────────────────────────────────────┘
```

```
PATCH /backend/users/me/colour  { colour: '#5C9ED4' }
```

- Optimistic update: preview immediately, revert on failure
- `<ColourPicker>` extracted to `shared/components/` — reused from onboarding step 2
- Occupied colours greyed out (same logic as onboarding)

---

### Device & Tracking Section

```
┌─────────────────────────────────────┐
│  Device & Tracking                  │
│                                     │
│  Status        ● Online             │
│  Last seen     Just now             │
│  Battery       🔋 84%               │
│                                     │
│  Tracking frequency  60s (fixed)    │
│                                     │
│  [ Reconnect Device ]               │
│  Use this if you switched phones    │
│  or reinstalled Traccar Client.     │
└─────────────────────────────────────┘
```

#### Status Logic
```ts
● Online   // lastUpdate < 30 min
⚠ Offline  // lastUpdate > 30 min
⏸ Paused   // device.disabled === true
```

#### Data Sources
- Status + last seen → `GET /api/positions` or WebSocket updates
- Battery → `position.attributes.batteryLevel` (shown conditionally, hidden if null)

- "Reconnect Device" launches 3-step re-onboarding flow reusing `<InstallStep>`, `<ConfigureStep>`, `<ConfirmStep>` from onboarding feature

---

### Notifications Section

```
┌─────────────────────────────────────┐
│  Notifications                      │
│                                     │
│  ── Events ────────────────────     │
│                        Own  Anyone  │
│  Geofence entered       ●     ●     │
│  Geofence exited        ●     ●     │
│  Speeding               ●     ●     │
│  Device offline         ●     ○     │
│  Low battery            ●     ○     │
│                                     │
│  ── ntfy (optional) ───────────     │
│  Install ntfy app  ↗  (link)        │
│                                     │
│  Your topic                         │
│  [whereis-a3f9bc21...________] ⎘   │
│  [  QR code to subscribe  ]         │
│  [ Send test notification ]         │
└─────────────────────────────────────┘
```

#### Event Scope Defaults

| Event | Own | Anyone |
|---|---|---|
| Geofence entered | ✅ | ✅ |
| Geofence exited | ✅ | ✅ |
| Speeding | ✅ | ✅ |
| Device offline | ✅ | ❌ |
| Low battery | ✅ | ❌ |

- Toggles write to `notification_prefs(user_id, event_type, scope, enabled)` — one row per (user_id, event_type, scope) combination
- ntfy QR encodes `ntfy://whereis-{uuid}` deep link — opens ntfy pre-subscribed on mobile
- Test notification → `POST /backend/notify/test` → backend sends to ntfy topic if configured
- ntfy topic auto-generated UUID stored in `ntfy_topics(user_id, topic, enabled)`

---

### Admin Section
*(Visible to admin role only)*

```
┌─────────────────────────────────────┐
│  Admin                              │
│                                     │
│  ── Invite Member ─────────────     │
│  Expires after                      │
│  ( 24 hours ) ( 7 days )            │
│                                     │
│  [ Generate Invite Link ]           │
│                                     │
│  https://tracking.elphiene.com/     │
│  invite?token=abc123   [ Copy ✓ ]  │
│  Expires 9 May 2026 · Single use    │
│                                     │
│  ── Members (4) ───────────────     │
│  [A] Alex (you)  👑                 │
│      ● Online · Just now            │
│                                     │
│  [S] Sarah                          │
│      ● Online · 4 min ago   [Remove]│
│                                     │
│  [J] Jordan                         │
│      ⚠ Offline · 2 hrs ago  [Remove]│
└─────────────────────────────────────┘
```

- Token expiry: 24h or 7 days — `expires_at` stored as timestamp (no "Never" option)
- Copy button shows ✓ for 2 seconds after copy
- Generating a new invite invalidates any existing active token
- Remove button → confirmation dialog → `DELETE /backend/members/{userId}`
- Backend: disables device in Traccar + deletes `group_members` row
- Admin row: 👑 badge, no remove button; admin cannot leave group

```
POST   /backend/invites           → generate token with expiry
DELETE /backend/invites/active    → invalidate current token
GET    /backend/members           → list with role + last position
DELETE /backend/members/{userId}  → admin only: remove + disable device
```

---

### Danger Zone

```
┌─────────────────────────────────────┐
│  ─────────────────────────────────  │
│                                     │
│  Leave Group                        │
│  Permanently removes your account   │
│  and deletes all your data.         │
│                                     │
│  [ Leave Group ]                    │
└─────────────────────────────────────┘
```

#### Confirmation Dialog
```
┌─────────────────────────────────────┐
│  Leave Group?                       │
│                                     │
│  This will:                         │
│  · Remove you from the group        │
│  · Delete your location history     │
│  · Stop your device from tracking   │
│  · Delete your account              │
│                                     │
│  This cannot be undone.             │
│                                     │
│  [ Cancel ]      [ Leave Group ]    │
└─────────────────────────────────────┘
```

#### Leave Flow
```
Confirm → POST /backend/leave
  ↓
Backend: DELETE group_members row
         PUT /api/devices/{id} { disabled: true }
         DELETE positions (Traccar purge)
         DELETE Traccar user account
  ↓
Session cleared → redirect to /left
```

#### `/left` Static Page
```
┌─────────────────────────────────────┐
│  WhereIs?                           │
│                                     │
│  You've left the group.             │
│                                     │
│  Your data has been deleted.        │
│                                     │
│  Want back in? Ask a group          │
│  member to send you an invite.      │
└─────────────────────────────────────┘
```
No session, no nav — fully static.

---

### Stub Pattern

```tsx
<SettingsPage>
  <AccountSection />        // empty → fill at build step 9
  <AppearanceSection />     // empty → fill at build step 10
  <DeviceSection />         // empty → fill at build step 11
  <NotificationsSection />  // empty → fill at build step 15
  <AdminSection />          // role-gated, fill at build step 16
  <DangerZone />            // empty → fill at build step 18
</SettingsPage>
```
Each section is a self-contained component — filling one never touches another.

### Folder Location
```
src/features/settings/
  components/
    AccountSection.tsx
    AppearanceSection.tsx
    DeviceSection.tsx
    NotificationsSection.tsx
    AdminSection.tsx
    DangerZone.tsx
  Settings.tsx              # page shell, back nav, section layout
```

### Shared Component Reuse
| Component | Source | Used in settings |
|---|---|---|
| `<ColourPicker>` | shared/components/ | AppearanceSection |
| `<InstallStep>` | features/onboarding/ | DeviceSection (reconnect) |
| `<ConfigureStep>` | features/onboarding/ | DeviceSection (reconnect) |
| `<ConfirmStep>` | features/onboarding/ | DeviceSection (reconnect) |
