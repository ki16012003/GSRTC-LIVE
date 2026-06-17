const axios = require('axios');
const https = require('https');
const config = require('../config');
const logger = require('../utils/logger');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let authToken = null;
let tokenPromise = null;

async function login() {
  try {
    const res = await axios.post(
      'https://live.gsrtc.org/api/auth/login',
      { username: 'Amnex_Admin', password: 'Amnex@123' },
      { timeout: 10000, httpsAgent }
    );
    authToken = res.data.token;
    logger.info('GSRTC API login successful, token obtained');
    return authToken;
  } catch (err) {
    logger.error(`GSRTC API login failed: ${err.message}`);
    throw err;
  }
}

async function getToken() {
  if (authToken) return authToken;
  if (tokenPromise) return tokenPromise;
  tokenPromise = login().finally(() => { tokenPromise = null; });
  return tokenPromise;
}

class InvalidVehicleError extends Error {
  constructor(vehicleNo) {
    super(`No live data found for vehicle "${vehicleNo}"`);
    this.name = 'InvalidVehicleError';
    this.vehicleNo = vehicleNo;
  }
}

class ApiUnavailableError extends Error {
  constructor(vehicleNo, cause) {
    super(`GSRTC API unavailable for vehicle "${vehicleNo}": ${cause}`);
    this.name = 'ApiUnavailableError';
    this.vehicleNo = vehicleNo;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVehicleData(raw) {
  const lat = parseFloat(raw.latitude);
  const lon = parseFloat(raw.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;
  return {
    vehicleNo: raw.vehicleNo,
    busNo: raw.busNo,
    latitude: lat,
    longitude: lon,
    location: raw.location,
    speed: parseFloat(raw.speed ?? '0') || 0,
    direction: raw.direction,
    ignition: raw.ignition,
    idle: raw.idle,
    running: raw.running,
    nocomm: raw.nocomm,
    underMaintenance: raw.underMaintenance,
    routeName: raw.routeName,
    routeId: raw.routeId,
    serviceType: raw.serviceType,
    depotName: raw.depotName,
    busOwner: raw.busOwner,
    conductorName: raw.conductorName,
    conductorNumber: raw.conductorNumber,
    makerName: raw.makerName,
    receivedDate: raw.receivedDate,
  };
}

async function fetchVehicleData(vehicleNo, attempt = 1) {
  const token = await getToken();
  try {
    const response = await axios.post(
      config.GSRTC_API_URL,
      { vehicleNo },
      {
        timeout: config.API_TIMEOUT,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        httpsAgent,
      }
    );

    const data = response.data;
    const parsed = parseVehicleData(data);
    if (!parsed) {
      throw new InvalidVehicleError(vehicleNo);
    }
    return parsed;
  } catch (err) {
    if (err instanceof InvalidVehicleError) throw err;

    if (err.response?.status === 401) {
      authToken = null;
      if (attempt < 2) {
        logger.warn(`GSRTC API auth expired for ${vehicleNo}, re-logging in...`);
        return fetchVehicleData(vehicleNo, attempt + 1);
      }
    }

    if (err.response && (err.response.status === 404 || err.response.status === 400)) {
      throw new InvalidVehicleError(vehicleNo);
    }

    if (attempt < config.API_MAX_RETRIES) {
      logger.warn(`GSRTC API call failed for ${vehicleNo} (attempt ${attempt}/${config.API_MAX_RETRIES}): ${err.message}. Retrying...`);
      await sleep(config.API_RETRY_DELAY * attempt);
      return fetchVehicleData(vehicleNo, attempt + 1);
    }

    logger.error(`GSRTC API call failed for ${vehicleNo} after ${config.API_MAX_RETRIES} attempts: ${err.message}`);
    throw new ApiUnavailableError(vehicleNo, err.message);
  }
}

async function fetchMultipleVehicles(vehicleNos, concurrency = 10) {
  const results = [];
  const queue = [...vehicleNos];
  const inFlight = new Set();

  async function worker() {
    while (queue.length > 0) {
      const vn = queue.shift();
      inFlight.add(vn);
      try {
        const data = await fetchVehicleData(vn);
        results.push(data);
      } catch (err) {
        if (!(err instanceof InvalidVehicleError)) {
          logger.warn(`fetchMultiple: ${err.message}`);
        }
      } finally {
        inFlight.delete(vn);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, vehicleNos.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = { fetchVehicleData, fetchMultipleVehicles, InvalidVehicleError, ApiUnavailableError };
