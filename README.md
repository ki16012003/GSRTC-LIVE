# GSRTC Live 3D Bus Map

A 24/7 background tracking system for the GSRTC bus fleet, visualized on a live CesiumJS 3D globe. The backend continuously polls the GSRTC vehicle API for every bus stored in the database and pushes position updates to connected browsers over Socket.IO — no manual refresh, no per-client polling, no Docker, no Python.

## Architecture

```
backend/                  Node.js + Express + Socket.IO + SQLite
  src/
    config/               Env-driven configuration with sane defaults
    database/              SQLite schema + connection (node:sqlite)
    services/
      gsrtcApi.js          GSRTC login + vehicle tooltip client (retry/timeout)
      busService.js        Bus CRUD, validation, search, stats
      settingsService.js   Runtime-tunable settings (DB-backed, no restart needed)
      importService.js     Bulk import parsing (paste / txt / csv / xlsx)
      logService.js        DB-backed event log
    tracking-engine/
      engine.js             24/7 polling loop: worker pool, queue, retry, status classification
    socket/                Socket.IO emit helpers
    routes/                REST API (buses, admin, settings, stats)
    middleware/auth.js     HTTP Basic Auth for /api/admin/*
    server.js               Entry point — starts HTTP server, Socket.IO, tracking engine

frontend/                 Next.js 15 (App Router) + TypeScript + Tailwind v4
  src/
    app/
      page.tsx              Full-screen live 3D map
      admin/page.tsx         Bulk import + bus management
      settings/page.tsx      Tracking engine / map settings
    components/
      map/CesiumMap.tsx      Imperative CesiumJS viewer, animated markers
      TopBar.tsx, BusInfoPanel.tsx, AdminLoginGate.tsx
      ui/                    Small shadcn-style primitives (button, card, input, ...)
    lib/                    REST client, Socket.IO client, types

ecosystem.config.js       PM2 process definitions for both apps
```

## How tracking works

1. The tracking engine loads every bus with `tracking_enabled = 1` from SQLite each cycle (so newly imported buses are picked up automatically, no restart required).
2. A worker pool (configurable count) pulls vehicle numbers off a queue and calls the GSRTC API concurrently.
3. Each result updates SQLite and is broadcast via Socket.IO (`bus:update`). Failures are logged and retried; a bus is marked `offline` only after it has been unreachable for `offlineAfterSeconds`. One bus failing never stops the cycle.
4. The cycle reschedules itself using the *current* settings (read fresh from the DB each time), so changing the interval/worker count/retry count from the Settings page takes effect on the very next cycle.

Bus status is classified as:
- **moving** — speed above the idle threshold
- **idle** — low speed, but not stationary long enough to count as stopped
- **stopped** — low speed and unchanged position for `stoppedAfterSeconds`
- **offline** — no successful update for `offlineAfterSeconds`

## Installation

### Prerequisites
- Node.js 18+ (uses the built-in `node:sqlite` module — no native build tools / Visual Studio required)
- npm

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env      # Windows; use `cp` on macOS/Linux
npm start
```

The server listens on `PORT` (default `4000`), auto-creates the SQLite database at `backend/database/gsrtc.db`, and starts the tracking engine immediately.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev      # development
# or
npm run build && npm start    # production
```

Open `http://localhost:3000`.

> Cesium's static assets (Workers/Assets/Widgets) are copied into `frontend/public/cesium` automatically before `dev`/`build` via `scripts/copy-cesium-assets.js`.

> `NEXT_PUBLIC_CESIUM_ION_TOKEN` is optional. Without it, the map uses OpenStreetMap imagery and flat ellipsoid terrain (no signup required). With a free token from https://ion.cesium.com/tokens, it upgrades to Cesium World Terrain, Bing satellite imagery, and OSM 3D Buildings.

### 3. Add buses to track

Open `http://localhost:3000/admin` (default login `admin` / `admin`, set via `ADMIN_USER`/`ADMIN_PASS` in `backend/.env`) and paste/upload vehicle numbers, e.g.:

```
GJ18Z6224
GJ18Z5511
GJ18Z9001
```

Buses appear on the map and begin tracking immediately — no restart needed.

## Running 24/7 with PM2 (Windows)

```bash
npm install -g pm2
cd frontend && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # follow the printed instructions to run PM2 on boot
```

Useful commands: `pm2 status`, `pm2 logs gsrtc-backend`, `pm2 restart gsrtc-backend`, `pm2 monit`.

## Configuration reference

All tracking parameters are overridable two ways:
- **Startup defaults**: `backend/.env` (see `.env.example`)
- **Live overrides**: the Settings page (`/settings`), stored in the `settings` SQLite table and read fresh every tracking cycle — no restart required.

| Setting | Default | Description |
|---|---|---|
| `TRACK_INTERVAL_SECONDS` | 4 | Seconds between polling cycles |
| `WORKER_COUNT` | 8 | Concurrent GSRTC API requests |
| `API_MAX_RETRIES` | 3 | Retries per failed vehicle request |
| `API_TIMEOUT` | 10000 | Per-request timeout (ms) |
| `OFFLINE_AFTER_SECONDS` | 120 | Time without data before marking a bus offline |
| `IDLE_SPEED_THRESHOLD` | 5 | km/h below which a bus is idle/stopped, not moving |
| `STOPPED_AFTER_SECONDS` | 300 | Low-speed duration before a bus is "stopped" rather than "idle" |

## REST API

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/buses` | — | All buses |
| `GET /api/buses/search?q=` | — | Search by vehicle/bus/route/depot |
| `GET /api/stats` | — | Fleet counts + last update time |
| `GET /api/settings` / `PUT /api/settings` | — | Read/update runtime settings |
| `POST /api/admin/buses/import` | Basic | Import `{ text }` or `{ vehicleNos }` |
| `POST /api/admin/buses/import-file` | Basic | Import via multipart `file` (txt/csv/xlsx) |
| `POST /api/admin/buses/delete` | Basic | `{ vehicleNos }` |
| `POST /api/admin/buses/enable` / `disable` | Basic | `{ vehicleNos }` |
| `GET /api/admin/logs` | Basic | Recent system log entries |

## Socket.IO events (server → client)

- `bus:update` — a single bus's live data changed
- `bus:added` — buses were imported
- `bus:removed` — buses were deleted
- `stats:update` — fleet-wide counters changed
