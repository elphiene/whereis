# whereis — Architecture

## Docker Services

| Service | Image | Port | Role |
|---|---|---|---|
| `cloudflared` | `cloudflare/cloudflared` | — | Tunnel outbound connector (bundled — disabled when host tunnel is used; see OPERATIONS) |
| `nginx` | `nginx:alpine` | 80 | Reverse proxy (single entry point) |
| `frontend` | `nginx:alpine` | — | Static React PWA build |
| `backend` | Bun | 3000 | Invite logic, webhook, SQLite, Traccar admin calls |
| `traccar` | `traccar/traccar` | 8082 | GPS tracking server |

All on an internal Docker network. Only `nginx` (and optionally `cloudflared`) face the public.

## Nginx Routing

| Path | Destination | Notes |
|---|---|---|
| `/` | `frontend` | Static React PWA |
| `/api/` | `traccar:8082` | Standard Traccar REST + session |
| `/backend/` | `backend:3000` | Thin Bun API |
| `/socket` | `traccar:8082` | WebSocket upgrade — Traccar live updates |

No CORS config needed — all requests share the same domain.

Nginx strips the `/backend/` prefix before forwarding, so the Bun server sees paths without it (e.g. `/users/me`, `/pause`). The `/webhook` endpoint is reached directly — it's Traccar-internal and carries no user auth.

## Design System

| Token | Value |
|---|---|
| Background | `#080808` |
| Surface | `#101010` |
| Surface2 | `#161616` |
| Accent (pink) | `#ec4899` |
| Accent (purple) | `#9354d3` |
| Muted text | `#a0a0a0` |
| Body font | Inter |
| Mono font | DM Mono |
| Logo font | Orbitron 800 — logo SVG only |
| Theme | Dark always (`dark` class on `<html>`) |

## SQLite Schema (backend)

```sql
invite_tokens(token, created_by, used_by, expires_at, used_at)
group_members(user_id, traccar_user_id, role, joined_at)   -- role: 'admin' | 'member'
user_devices(user_id, uuid, traccar_device_id, created_at)
user_colours(user_id, colour_hex, assigned_at)
ntfy_topics(user_id, topic, enabled)
notification_prefs(user_id, event_type, scope, enabled)    -- scope: 'own' | 'anyone'
```

## Backend

### Endpoints

```
GET    /backend/invite/:token          → validate invite token
POST   /backend/invites                → admin: generate token
DELETE /backend/invites/active         → admin: invalidate token
GET    /backend/members                → list members with role + last position
DELETE /backend/members/:userId        → admin: remove member + disable Traccar device
POST   /backend/leave                  → self: leave group + delete account
POST   /backend/pause                  → disable own device
POST   /backend/resume                 → re-enable own device
PATCH  /backend/users/me/colour        → update colour in SQLite
POST   /backend/notify/test            → send test ntfy notification
POST   /webhook                        → Traccar event webhook → ntfy forwarding
POST   /backend/register               → invite-token register (validates token, inserts group_members + user_devices, shares Traccar perms)
```

### Source layout

```
backend/
├── index.ts                   # entry — wires router, starts Bun.serve on PORT
├── package.json
├── Dockerfile
└── src/
    ├── db/
    │   └── schema.ts          # bun:sqlite init, all 6 CREATE IF NOT EXISTS
    ├── lib/
    │   ├── router.ts          # tiny pattern-based Router + json() helper
    │   └── traccar.ts         # traccarAdmin() — fetch wrapper with admin Basic-Auth header; exports NTFY_BASE_URL
    ├── middleware/
    │   └── auth.ts            # requireAuth(req), requireAdmin(req)
    └── routes/
        ├── users.ts           # GET /users/me, PATCH /users/me/colour
        ├── colours.ts         # GET /colours
        ├── invites.ts         # GET /invite/:token, POST /invites, DELETE /invites/active
        ├── members.ts         # GET /members, DELETE /members/:userId
        ├── tracking.ts        # POST /pause, POST /resume, POST /leave
        ├── notifications.ts   # GET|PUT /notifications/prefs, POST /notify/test
        └── webhook.ts         # POST /webhook
```

### Auth middleware

`requireAuth(req)` — forwards `cookie` header to `GET {TRACCAR_URL}/api/session`. Returns the decoded `TraccarUser` or a `401 Response`. Result is not cached globally; each handler call resolves independently.

`requireAdmin(req)` — calls `requireAuth`, then checks `group_members.role = 'admin'` in SQLite. Returns `403` if authenticated but not admin.

## Frontend

### Source layout

```
frontend/
├── index.html                      # class="dark" on <html>
├── vite.config.ts                  # path alias @/ → src/, vite-plugin-pwa
├── tailwind.config.ts              # design tokens + shadcn CSS-var bridge
├── components.json                 # shadcn/ui (neutral base, dark, CSS vars)
├── Dockerfile                      # bun build → nginx:alpine static serve
├── nginx.conf                      # SPA fallback + asset caching
└── src/
    ├── main.tsx                    # createRoot
    ├── App.tsx                     # hydrate on mount, BrowserRouter + all routes
    ├── index.css                   # Google Fonts import, Tailwind directives, CSS vars
    ├── stores/
    │   ├── auth.store.ts           # Zustand: { user, loading, error, hydrate(), clear() }
    │   └── socket.store.ts         # Zustand: { connected }
    ├── shared/
    │   ├── hooks/                  # useTraccarSocket, etc.
    │   ├── lib/
    │   │   ├── traccar.ts          # api() fetch wrapper (credentials: 'include') + SERVER_URL
    │   │   └── utils.ts            # cn() (clsx + tailwind-merge)
    │   ├── types/
    │   │   └── traccar.ts          # TraccarPosition, TraccarDevice, TraccarUser, TraccarGeofence
    │   └── components/             # shared UI components (shadcn installs here)
    ├── routes/                     # page-level components + RequireAuth
    └── features/                   # map, friends, history, geofences, stats, notifications, onboarding, settings
```

### Route map

| Path | Component | Auth |
|---|---|---|
| `/login` | `LoginPage` | Redirects to `/map` if already authed |
| `/invite` | `InviteLanding` | Public |
| `/left` | `LeftPage` | Public, no nav |
| `/map` | `MapPage` | RequireAuth |
| `/history` | `HistoryPage` | RequireAuth |
| `/stats` | `StatsPage` | RequireAuth |
| `/geofences` | `GeofencesPage` | RequireAuth |
| `/settings` | `SettingsPage` | RequireAuth |
| `/*` | → `/map` | (RequireAuth handles redirect to login) |

### Canonical patterns

- **Auth hook:** `useAuthStore` from `@/stores/auth.store` — import directly. The `useAuth` wrapper was removed.
- **Fetch wrapper:** `api()` from `@/shared/lib/traccar` — use for every internal API call (`/api/…`, `/backend/…`). Sets `credentials: 'include'` and `Content-Type: application/json`. External URLs (ntfy.sh, OpenFreeMap tiles) use plain `fetch`.
- **Spinner:** `<Spinner />` from `@/shared/components/Spinner` — the single canonical loading indicator.
- **`traccarDeviceId` on members:** explicitly returned by `GET /backend/members` from the `user_devices` table. The frontend `BackendMember` interface includes it. Do not assume `traccarDeviceId === userId`.
- **`NTFY_BASE_URL`:** exported from `backend/src/lib/traccar.ts` — import from there in any backend file that needs it.

### Auth flow

1. `App` mounts → `useAuthStore.hydrate()` → `GET /backend/users/me` (with `credentials: 'include'`)
2. 200 → `user` set, `loading = false` → app renders
3. 401 → `user = null`, `loading = false` → `RequireAuth` redirects to `/login?redirect=…`
4. Login: `POST /api/session` → on success, `hydrate()` again → navigate to `/map` or `?redirect=`
5. Session expiry mid-session: any API 401 → `RequireAuth` catches on next navigation

### Map instance

`features/map/hooks/useMapInstance.ts` exports a module-level singleton:

```ts
export const mapInstance: { current: maplibregl.Map | null } = { current: null };
```

`MapView` sets it on init and nulls it on cleanup. **History and geofences must import this ref and never create their own MapLibre instance.** (See known gaps — currently they DO create separate instances.)

### Store shapes

**`features/map/store.ts`** — `useMapStore`
```ts
positions: Record<userId, MapPosition>  // updated by WS + initial load
selectedFriendId: number | null
setPosition(pos)
setPositions(positions[])
setSelectedFriendId(id)
```

**`features/friends/store.ts`** — `useFriendsStore`
```ts
members: Member[]    // sorted: Moving → Stationary → Paused → Offline
loading: boolean
loadMembers()        // GET /backend/members + GET /api/devices → builds Member[]
updateFromDevice(deviceId, disabled, lastUpdate)
setMemberDisabled(userId, disabled)  // optimistic pause/resume
setMemberSpeed(deviceId, speed, lastUpdate)  // called by WS hook
```

`Member`: `{ userId, traccarDeviceId, name, colour, role, lastUpdate, deviceDisabled, speed }`
`getMemberStatus(m)` → `'moving' | 'stationary' | 'paused' | 'offline'` (derived, not stored).

**`stores/socket.store.ts`** — `useSocketStore`
```ts
connected: boolean
setConnected(connected)
```

**`shared/hooks/useTraccarSocket.ts`**
- Connects to `ws(s)://host/socket` (Nginx proxies → Traccar WebSocket)
- Parses `{ positions, devices }` messages
- Resolves `deviceId → userId` via `useFriendsStore.members`
- Dispatches to `useMapStore.setPosition` + `useFriendsStore.setMemberSpeed`
- Auto-reconnects: exponential backoff 1s → 30s max

### Onboarding feature

```
features/onboarding/
├── InviteLanding.tsx              # /invite?token= — validates token, stores in sessionStorage
├── Wizard.tsx                     # /onboarding — step orchestrator
├── hooks/
│   ├── useOnboardingState.ts      # localStorage read/write for 'onboarding_state'
│   └── useDevicePoller.ts         # polls GET /api/positions every 10s, max 12 attempts (2 min)
└── components/
    ├── WizardShell.tsx            # card container + StepDots + error banner
    ├── StepDots.tsx               # 5 dots: active #ec4899, done rgba(pink,0.35), upcoming white/12
    ├── AccountStep.tsx            # step 1: create Traccar user → login → device → POST /backend/register
    ├── ColourStep.tsx             # step 2: GET /backend/colours, auto-assign, PATCH /backend/users/me/colour
    ├── InstallStep.tsx            # step 3: platform-detect (iOS/Android/Desktop), QR codes, store links
    ├── ConfigureStep.tsx          # step 4: deep link + QR + manual copy accordion
    └── ConfirmStep.tsx            # step 5: pulse waiting → success (auto-advance 3s) → help (timeout)
```

**localStorage key:** `onboarding_state`
```ts
{
  step: number;              // 1–5
  accountCreated: boolean;
  colourChosen: boolean;
  deviceConfigured: boolean; // false → SetupBanner shown on MapPage
  email: string;
  name: string;
  uuid: string | null;       // Traccar device uniqueId
  traccarUserId: number | null;
  traccarDeviceId: number | null;
  colour: string | null;
}
```

Cleared on wizard completion (`reset()`) or manual restart.

**sessionStorage key:** `invite_token` — set by InviteLanding, consumed by AccountStep's POST /backend/register.

### Settings sections — all complete

| Section | Status |
|---|---|
| `AccountSection` | Full — PUT /api/users/{id}, email warning, password show/hide, success toast |
| `AppearanceSection` | Full — ColourPicker, optimistic update, PATCH /backend/users/me/colour |
| `DeviceSection` | Full — device status, inline 3-step reconnect flow (self-contained, no WizardShell) |
| `NotificationsSection` | Full — 5×2 toggle grid, ntfy topic QR, test notification |
| `AdminSection` | Full — invite generation + copy, member list, remove with dialog |
| `DangerZone` | Full — POST /backend/leave, confirmation dialog, redirect /left |

### Feature pages — all complete

**History** (`/history`)
- Desktop: 280px sidebar + map area
- Member dropdown + DatePresetChips → GET /api/reports/trips
- Trip click → lazy GET /api/reports/route → MapLibre LineString
- Start pin (green) + end pin (member colour)
- Trip detail popover (absolute top-left)
- "← Back to live" button → /map

**Geofences** (`/geofences`)
- Loads all geofences from GET /api/geofences on map ready
- Each rendered as fill + dashed line MapLibre layers
- Draw mode: click center, radius slider + input, name + alert config → POST /api/geofences + POST /api/notifications
- Sidebar list: click → flyTo, inline edit, delete with confirmation

**Stats** (`/stats`)
- DatePresetChips → calls GET /api/reports/summary + trips + events per member in parallel
- Group overview: leaderboard cards (sorted by distance), stacked BarChart, events list
- Click card → per-friend drill-down: 4 stat cards, per-day distance BarChart (Recharts), events list

## PWA configuration

- **SW:** registered by vite-plugin-pwa via Workbox. Auto-generated at build time as `dist/sw.js`
- **Manifest:** generated from `vite.config.ts` → served at `/manifest.webmanifest`
- **App shell precaching:** all `*.{js,css,html,ico,png,svg,webp}` bundles precached at SW install via `globPatterns`
- **Map tiles:** cache-first, `cacheName: 'map-tiles'`, max 500 entries, 30-day TTL
- **Icons:** source SVG at `frontend/public/icon.svg`; generated `icon-192.png` and `icon-512.png`. Regenerate after icon changes: `npm run generate:icons` (uses `@resvg/resvg-js`)

Manifest values: `name=WhereIs?`, `short_name=WhereIs`, `theme_color=#ec4899`, `background_color=#080808`, `display=standalone`, `start_url=/map`.

**No offline fallback UI** — app shell precaches JS/CSS; live data shows stale or empty when offline. Intentional.

## Known gaps (deferred)

| Item | Notes |
|---|---|
| Traccar `registration.enable` config | Add `<entry key='registration'>true</entry>` to `traccar/traccar.xml` if self-registration is blocked |
| Map tile attribution | OpenFreeMap requires attribution — add `attributionControl: true` or a custom overlay to MapView |
| Session expiry re-auth modal | Onboarding shows inline error on 401; a full re-login modal (pre-filling email) was deferred |
| History/Geofences on live map | Both create their own MapLibre instances; original intent was overlays sharing `mapInstance`. Future: render as modes within `/map` |
| Mobile bottom nav bar | Wireframe shows a 4-tab bottom nav; not implemented |
| Capacitor wrapper | App-store distribution via Capacitor not started |
| Domain migration | Moving from `tracking.elphiene.com` → `cherryslabs.com` requires users to redo device setup (VITE_SERVER_URL is baked at build time) |
| `bun.lockb` in frontend | `bun` not on dev machine; npm was used for icon generation. Run `bun install` in Docker or CI to generate |
