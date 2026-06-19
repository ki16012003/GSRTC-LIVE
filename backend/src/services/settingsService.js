const db = require('../database/db');
const config = require('../config');

const DEFAULTS = {
  trackIntervalSeconds: config.TRACK_INTERVAL_SECONDS,
  workerCount: config.WORKER_COUNT,
  apiMaxRetries: config.API_MAX_RETRIES,
  apiTimeout: config.API_TIMEOUT,
  offlineAfterSeconds: config.OFFLINE_AFTER_SECONDS,
  idleSpeedThreshold: config.IDLE_SPEED_THRESHOLD,
  stoppedAfterSeconds: config.STOPPED_AFTER_SECONDS,
  mapDefaultLat: 23.0225,
  mapDefaultLon: 72.5714,
  mapDefaultZoom: 7,
  theme: 'light',
};

const NUMERIC_KEYS = new Set([
  'trackIntervalSeconds', 'workerCount', 'apiMaxRetries', 'apiTimeout',
  'offlineAfterSeconds', 'idleSpeedThreshold', 'stoppedAfterSeconds',
  'mapDefaultLat', 'mapDefaultLon', 'mapDefaultZoom',
]);

const getAllStmt = db.prepare('SELECT key, value FROM settings');
const upsertStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function getSettings() {
  const rows = getAllStmt.all();
  const stored = {};
  for (const row of rows) stored[row.key] = row.value;

  const merged = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (stored[key] !== undefined) {
      merged[key] = NUMERIC_KEYS.has(key) ? Number(stored[key]) : stored[key];
    }
  }
  return merged;
}

function updateSettings(patch) {
  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (!(key in DEFAULTS)) continue;
      upsertStmt.run(key, String(value));
    }
  });
  tx(Object.entries(patch));
  return getSettings();
}

module.exports = { getSettings, updateSettings, DEFAULTS };
