const gsrtcApi = require('../services/gsrtcApi');
const busService = require('../services/busService');
const settingsService = require('../services/settingsService');
const logService = require('../services/logService');
const socket = require('../socket');

// Per-vehicle in-memory tracking state, used only to classify moving/idle/stopped.
const vehicleState = new Map();

let running = false;
let cycleTimer = null;
let cycleInFlight = false;

function classifyStatus(vehicleNo, data, settings) {
  const now = Date.now();
  const prev = vehicleState.get(vehicleNo) || { lowSpeedSince: null, lastLat: null, lastLon: null };

  let status;
  if (data.speed > settings.idleSpeedThreshold) {
    status = 'moving';
    prev.lowSpeedSince = null;
  } else {
    const positionUnchanged = prev.lastLat === data.latitude && prev.lastLon === data.longitude;
    if (!prev.lowSpeedSince) prev.lowSpeedSince = now;
    const lowSpeedDurationSec = (now - prev.lowSpeedSince) / 1000;
    status = positionUnchanged && lowSpeedDurationSec >= settings.stoppedAfterSeconds ? 'stopped' : 'idle';
  }

  prev.lastLat = data.latitude;
  prev.lastLon = data.longitude;
  prev.lastSeenAt = now;
  prev.consecutiveFailures = 0;
  vehicleState.set(vehicleNo, prev);

  return status;
}

function handleFailure(vehicleNo, settings) {
  const prev = vehicleState.get(vehicleNo) || { lastSeenAt: null, consecutiveFailures: 0 };
  prev.consecutiveFailures = (prev.consecutiveFailures || 0) + 1;
  vehicleState.set(vehicleNo, prev);

  const lastSeenAt = prev.lastSeenAt;
  const offlineDurationSec = lastSeenAt ? (Date.now() - lastSeenAt) / 1000 : Infinity;

  if (offlineDurationSec >= settings.offlineAfterSeconds) {
    const bus = busService.markOffline(vehicleNo);
    if (bus) socket.emitBusUpdate(bus);
  }
}

async function trackVehicle(vehicleNo, settings) {
  try {
    const data = await gsrtcApi.fetchVehicleData(vehicleNo, {
      maxRetries: settings.apiMaxRetries,
      timeout: settings.apiTimeout,
    });
    const status = classifyStatus(vehicleNo, data, settings);
    const bus = busService.updateLiveData(vehicleNo, data, status);
    if (bus) socket.emitBusUpdate(bus);
  } catch (err) {
    if (err instanceof gsrtcApi.InvalidVehicleError) {
      logService.log('tracking', 'warn', err.message, vehicleNo);
    } else {
      logService.log('tracking', 'error', err.message, vehicleNo);
    }
    handleFailure(vehicleNo, settings);
  }
}

async function runCycle() {
  if (cycleInFlight) return;
  cycleInFlight = true;

  try {
    const settings = settingsService.getSettings();
    const buses = busService.getTrackedBuses();
    const queue = buses.map((b) => b.vehicle_no);

    const workerCount = Math.max(1, Math.min(settings.workerCount, queue.length || 1));
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length) {
        const vehicleNo = queue.shift();
        if (!vehicleNo) break;
        await trackVehicle(vehicleNo, settings);
      }
    });

    await Promise.all(workers);

    const stats = busService.getStats();
    socket.emitStats({ ...stats, lastUpdate: new Date().toISOString() });
  } catch (err) {
    logService.log('tracking', 'error', `Tracking cycle failed: ${err.message}`);
  } finally {
    cycleInFlight = false;
  }
}

function scheduleNext() {
  if (!running) return;
  const settings = settingsService.getSettings();
  const intervalMs = Math.max(1, settings.trackIntervalSeconds) * 1000;
  cycleTimer = setTimeout(async () => {
    await runCycle();
    scheduleNext();
  }, intervalMs);
}

function start() {
  if (running) return;
  running = true;
  logService.log('tracking', 'info', 'Tracking engine started');
  runCycle().then(scheduleNext);
}

function stop() {
  running = false;
  if (cycleTimer) clearTimeout(cycleTimer);
  logService.log('tracking', 'info', 'Tracking engine stopped');
}

module.exports = { start, stop };
