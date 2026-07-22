# whereis — Operations

Runbook for deploying, restarting, and recovering whereis.

## Dev mode

```bash
# Frontend
cd frontend
bun install
bun run dev        # Vite dev server

# Backend
cd backend
bun install
bun run dev        # Bun with --watch

# Full stack (Docker)
docker compose up -d
docker compose logs -f

# Rebuild after code change
docker compose up -d --build frontend
docker compose up -d --build backend
```

## Eldev test deploy (current)

The project is currently deployed locally on `127.0.0.1:8083` and tunneled to `eldev.cherrysofa.com` via the host's existing cloudflared service (the project-bundled cloudflared container is disabled).

This is controlled by `docker-compose.override.yml`:
- Sets `profiles: ["disabled"]` on the bundled `cloudflared` service
- Exposes `nginx` on `127.0.0.1:8083`

Docker Compose auto-loads `docker-compose.override.yml`, so `docker compose up -d` Just Works here.

### One-time setup steps

1. `cp backend/.env.example backend/.env` and fill in:
   - `TRACCAR_ADMIN_PASSWORD` — set immediately after first Traccar login (default is `admin`/`admin`)
   - `PUBLIC_URL=https://eldev.cherrysofa.com`
   - `NTFY_BASE_URL=https://ntfy.sh` (or your own ntfy server)
2. `docker compose up -d` — first run will build images, ~3 min
3. Visit `http://127.0.0.1:8083` locally to verify nginx serves the frontend
4. Add ingress entry in `~/.cloudflared/config.yml` (already done as of 2026-05-28):
   ```yaml
   - hostname: eldev.cherrysofa.com
     service: http://localhost:8083
   ```
5. `sudo systemctl restart cloudflared`
6. **Add Cloudflare DNS** on Cherry's account (cherrysofa.com is on Cherry's CF account, not El's):
   - `eldev` CNAME → `298a0402-1fa7-4a89-b7d1-3f42995dc6cb.cfargotunnel.com` (proxied)
   - Or replace the existing A record if there is one

### After code changes

```bash
docker compose up -d --build frontend   # if only frontend changed
docker compose up -d --build backend    # if only backend changed
docker compose up -d --build            # both
```

### Healthcheck

```bash
docker ps --filter "name=whereis" --format "{{.Names}}\t{{.Status}}"
curl -s http://127.0.0.1:8083/ -o /dev/null -w "HTTP %{http_code}\n"
curl -s https://eldev.cherrysofa.com/ -o /dev/null -w "HTTP %{http_code}\n"  # once DNS is set
```

The top-level status script `check-projects` covers the whereis containers automatically.

## Future production deploy (tracking.elphiene.com or cherryslabs.com)

When moving from eldev to the future production domain:

1. **Important caveat:** `VITE_SERVER_URL` is baked into the frontend at build time. Existing users will need to redo device setup (step 4 of onboarding) when the server URL changes. Plan a notification.
2. Same flow as eldev — just update the DNS target and the cloudflared ingress entry.
3. Or, switch back to the project-bundled cloudflared container by removing `docker-compose.override.yml` — but then you need a separate tunnel token in `cloudflared.env`.

## Database

- SQLite lives in the `data/` Docker volume → bind-mounted from `./data/`
- Backup: `cp -a data/whereis.db data/whereis.db.bak` (after stopping backend) or `docker compose exec backend cp /data/whereis.db /data/whereis.db.bak` while running
- Schema lives in `backend/src/db/schema.ts` — all `CREATE IF NOT EXISTS` so safe to re-run
- Migrations: no system yet. Schema changes should be additive (new columns/tables only) until a real migration story is in place.

## Traccar

- Configured via `traccar/traccar.xml` (NOT env vars)
- Persistent state in the `traccar-data` Docker volume
- Default credentials: `admin` / `admin` — **change immediately after first login** and update `backend/.env`
- Geocoder: uses Traccar's hosted Nominatim (`geocoder.traccar.org`) — no API key needed

## Webhooks

`POST /webhook` is hit directly by Traccar (Nginx forwards without the `/backend/` prefix). It carries no user auth — Traccar-internal only. Don't expose this path externally beyond what Nginx already does internally.

## Backups (manual for now)

There's no automated backup. Suggested cron job:

```bash
# /etc/cron.daily/whereis-backup
#!/bin/bash
cd /home/el/Documents/El-Projects/whereis
tar -czf /backups/whereis-$(date +%F).tgz data/
find /backups -name "whereis-*.tgz" -mtime +30 -delete
```

## Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend loads but no data | Backend can't reach Traccar | Check `docker compose logs backend` — wrong `TRACCAR_URL` in `.env`? |
| 401 on every request | Session cookie not forwarded | Verify `credentials: 'include'` in `api()` calls; check nginx config doesn't strip `cookie` |
| Map blank | OpenFreeMap blocked / tiles failing | Check browser network tab for tile URLs; fall back to MapLibre demo style temporarily |
| Webhooks not firing | Traccar webhook URL wrong | In Traccar admin UI, set webhook URL to `http://backend:3000/webhook` (internal Docker DNS) |
| Build fails on `dark` class | Tailwind v3 `@apply dark` issue | Already fixed in `src/index.css` — `dark` class is set on `<html>` directly in `index.html` |
