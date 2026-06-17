# GSRTC Live Vehicle Tracking Telegram Bot

A production-ready Node.js Telegram bot that tracks GSRTC buses in real time
using the public live-tracking API at `https://live.gsrtc.org/api/vehicle/tooltip`.

Multiple users can track different (or the same) buses simultaneously. The
bot polls the GSRTC API every `POLL_INTERVAL` seconds per tracked vehicle,
detects meaningful changes (position, speed, ignition, running state), and
pushes live updates and alerts to Telegram automatically.

## Features

- `/track <vehicleNumber>` — start live tracking of a bus
- `/status` — current tracking status
- `/location` — fetch current coordinates + Telegram location pin + Maps link
- `/route` — current route information
- `/stoptrack` — stop tracking, see total tracking duration
- Automatic alerts:
  - ▶ Bus Started Moving
  - 🛑 Bus Stopped
  - ⚠ GPS Communication Lost
  - 🔧 Vehicle Under Maintenance
- Admin commands: `/activeusers`, `/activevehicles`, `/broadcast <message>`
- SQLite persistence (users, tracking sessions, vehicle history)
- Automatic retries on GSRTC API / network failures
- Resumes all active tracking sessions automatically on restart
- Structured logging (Winston, daily-rotating files)
- PM2 process management with auto-restart

## Project Structure

```
/src
  /bot          - Telegram bot setup & wiring
  /commands     - One file per bot command
  /config       - Environment/config loader
  /database     - SQLite schema, connection, and queries
  /services     - GSRTC API client and the tracking/polling engine
  /utils        - Logger, formatters, validators, geo helpers
  app.js        - Entry point (Express health server + bot + tracker)
ecosystem.config.js  - PM2 process configuration
.env.example          - Environment variable template
data/                  - SQLite database file (gitignored)
logs/                  - Log files (gitignored)
```

## Requirements

- Node.js >= 18
- npm
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- (Production) [PM2](https://pm2.keymetrics.io/) — `npm i -g pm2`

## Installation

```bash
git clone <this-repo>
cd gsrtc
npm install
cp .env.example .env
```

Edit `.env`:

```ini
BOT_TOKEN=123456789:your-telegram-bot-token
ADMIN_ID=123456789          # your numeric Telegram chat id
POLL_INTERVAL=60
```

> Get your numeric chat ID by messaging [@userinfobot](https://t.me/userinfobot) on Telegram.

## Running

### Development

```bash
npm run dev
```

### Production (plain Node)

```bash
npm start
```

### Production (PM2 — recommended)

```bash
npm i -g pm2
npm run pm2:start     # starts the bot under PM2
pm2 save              # persist process list
pm2 startup           # generate OS startup script (run the printed command)

npm run pm2:logs      # tail logs
npm run pm2:restart   # restart after code/config changes
npm run pm2:stop      # stop the bot
```

PM2 will automatically restart the bot if it crashes (`autorestart: true`,
`max_restarts: 10`, 5s restart delay) and on server reboot once `pm2 save`
and `pm2 startup` have been configured.

## Database

SQLite database file is created automatically at the path configured by
`DB_PATH` (default `./data/gsrtc_bot.db`), with WAL mode enabled for safe
concurrent access. Schema (`src/database/schema.sql`) creates three tables:

- **users** — `chat_id`, `username`, `first_name`, `is_admin`, `created_at`
- **tracking_sessions** — one row per tracking session: `chat_id`,
  `vehicle_number`, `start_time`, `end_time`, last known
  latitude/longitude/speed/direction/ignition/running/nocomm/maintenance,
  `tracking_status` (`active`/`stopped`)
- **vehicle_history** — a row per detected state change for a session
  (position, speed, direction, ignition, running, nocomm, maintenance)

No manual migration step is needed — the schema is applied automatically on
startup (`CREATE TABLE IF NOT EXISTS ...`).

## Tracking Engine

- One polling timer runs per **unique vehicle number** (shared across all
  users tracking that bus), every `POLL_INTERVAL` seconds.
- A live update message is sent only when something meaningful changed:
  latitude/longitude, speed, running state, or ignition — **and** either the
  bus moved at least `MOVE_THRESHOLD_METERS` (default 100m) or a non-position
  field (speed/running/ignition) changed. This avoids spamming users with GPS
  jitter while a bus is parked.
- Alerts (started moving, stopped, GPS lost, under maintenance) are evaluated
  independently every poll, regardless of distance moved.
- All polling timers are restored automatically on process restart by reading
  active sessions from SQLite.

## Error Handling

- **Invalid vehicle number** — GSRTC returns no usable location data → user
  gets a clear "vehicle not found" message, no session is created.
- **GSRTC API failure / timeout** — automatic retries with backoff
  (`API_MAX_RETRIES`, `API_RETRY_DELAY`, `API_TIMEOUT`). If all retries fail,
  the poll is skipped and logged; tracking continues on the next cycle.
- **Telegram API errors** (e.g. user blocked the bot) — caught and logged per
  message, never crash the polling loop.
- **Database errors** — caught, logged with context, and re-thrown so calling
  command handlers can show a friendly error message.
- **Uncaught exceptions / unhandled rejections** — logged, process kept alive
  (PM2 provides the restart safety net for unrecoverable cases).

## Logging

Winston writes daily-rotating logs to `LOG_DIR` (default `./logs`):

- `combined-YYYY-MM-DD.log` — all log levels
- `error-YYYY-MM-DD.log` — errors only

Logs are retained for 14 days / capped at 10MB per file. In non-production
(`NODE_ENV !== 'production'`), logs are also printed to the console.

## Security Best Practices

- **Never commit `.env`** — it's already in `.gitignore`. Only commit
  `.env.example`.
- **Restrict admin commands** — `/activeusers`, `/activevehicles`, and
  `/broadcast` only respond to the chat ID in `ADMIN_ID`.
- **Run as a non-root user** in production, and restrict filesystem
  permissions on `data/` and `logs/` to that user.
- **Keep dependencies updated** — run `npm audit` periodically.
- **Validate all user input** — vehicle numbers are normalized and validated
  against a strict pattern (`src/utils/validators.js`) before being sent to
  the GSRTC API.
- **Rotate your bot token** via @BotFather if it is ever exposed, and update
  `.env` + restart the bot (`pm2 restart gsrtc-tracking-bot`).
- **Rate limiting** — the per-vehicle polling design naturally limits load on
  the GSRTC API regardless of how many users are tracking the same bus.

### A note on `npm audit`

`node-telegram-bot-api@0.66.0` pulls in a deprecated `request`-based HTTP
client, which `npm audit` flags for vulnerabilities in `form-data`, `qs`,
`tough-cookie`, and `uuid`. These transitive dependencies are only used
internally by the library to call `api.telegram.org` with your bot token —
this bot never feeds attacker-controlled multipart bodies, cookies, or query
strings through them, so practical exploitability here is low. The fix
(`node-telegram-bot-api@1.x`) is a very recent ESM-only TypeScript rewrite
with a different module/API surface; re-evaluate migrating to it (or to
`grammy`/`telegraf`) once it stabilizes.

## Health Check

An Express server exposes a health endpoint for uptime monitoring:

```
GET http://localhost:<PORT>/health
```

```json
{
  "status": "ok",
  "uptimeSeconds": 1234,
  "activeSessions": 3,
  "trackedVehicles": ["GJ18Z6224", "GJ01AB1234"]
}
```

## Environment Variables

| Variable                | Default                                     | Description                                  |
| ------------------------ | -------------------------------------------- | --------------------------------------------- |
| `BOT_TOKEN`             | _(required)_                                | Telegram bot token from @BotFather           |
| `ADMIN_ID`              | _(required)_                                | Numeric chat ID with admin command access    |
| `POLL_INTERVAL`         | `60`                                         | Seconds between GSRTC API polls per vehicle  |
| `GSRTC_API_URL`         | `https://live.gsrtc.org/api/vehicle/tooltip` | GSRTC tooltip API endpoint                   |
| `MOVE_THRESHOLD_METERS` | `100`                                        | Minimum movement (m) to trigger a live update |
| `DB_PATH`               | `./data/gsrtc_bot.db`                       | SQLite database file path                    |
| `LOG_DIR`               | `./logs`                                     | Log file directory                           |
| `LOG_LEVEL`             | `info`                                       | Winston log level                            |
| `PORT`                  | `3000`                                       | Health-check HTTP server port                |
| `API_MAX_RETRIES`       | `3`                                          | Max retries for GSRTC API calls              |
| `API_RETRY_DELAY`       | `2000`                                       | Base delay (ms) between retries              |
| `API_TIMEOUT`           | `10000`                                      | GSRTC API request timeout (ms)               |
