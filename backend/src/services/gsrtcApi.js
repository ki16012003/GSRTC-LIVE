const axios = require('axios');
const https = require('https');
const config = require('../config');
const logger = require('../utils/logger');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let authToken = null;
let tokenPromise = null;

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

async function login() {
  const res = await axios.post(
    config.GSRTC_LOGIN_URL,
    { username: config.GSRTC_USERNAME, password: config.GSRTC_PASSWORD },
    { timeout: config.API_TIMEOUT, httpsAgent }
  );
  authToken = res.data.token;
  logger.info('GSRTC API login successful, token obtained');
  return authToken;
}

async function getToken() {
  if (authToken) return authToken;
  if (tokenPromise) return tokenPromise;
  tokenPromise = login()
    .catch((err) => {
      logger.error(`GSRTC API login failed: ${err.message}`);
      throw err;
    })
    .finally(() => {
      tokenPromise = null;
    });
  return tokenPromise;
}

function clearToken() {
  authToken = null;
}

function parseVehicleData(raw) {
  if (!raw) return null;
  const lat = parseFloat(raw.latitude);
  const lon = parseFloat(raw.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return {
    vehicleNo: raw.vehicleNo,
    busNo: raw.busNo,
    latitude: lat,
    longitude: lon,
    speed: parseFloat(raw.speed ?? '0') || 0,
    direction: raw.direction || null,
    routeName: raw.routeName || null,
    depotName: raw.depotName || null,
    receivedDate: raw.receivedDate || null,
  };
}

async function fetchVehicleData(vehicleNo, options = {}, attempt = 1) {
  const maxRetries = options.maxRetries ?? config.API_MAX_RETRIES;
  const timeout = options.timeout ?? config.API_TIMEOUT;
  const token = await getToken();

  try {
    const response = await axios.post(
      config.GSRTC_API_URL,
      { vehicleNo },
      {
        timeout,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        httpsAgent,
      }
    );

    const parsed = parseVehicleData(response.data);
    if (!parsed) throw new InvalidVehicleError(vehicleNo);
    return parsed;
  } catch (err) {
    if (err instanceof InvalidVehicleError) throw err;

    if (err.response?.status === 401) {
      clearToken();
      if (attempt < 2) {
        logger.warn(`GSRTC API auth expired for ${vehicleNo}, re-logging in...`);
        return fetchVehicleData(vehicleNo, options, attempt + 1);
      }
    }

    if (err.response && (err.response.status === 404 || err.response.status === 400)) {
      throw new InvalidVehicleError(vehicleNo);
    }

    if (attempt < maxRetries) {
      logger.warn(`GSRTC API call failed for ${vehicleNo} (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying...`);
      await sleep(config.API_RETRY_DELAY * attempt);
      return fetchVehicleData(vehicleNo, options, attempt + 1);
    }

    logger.error(`GSRTC API call failed for ${vehicleNo} after ${maxRetries} attempts: ${err.message}`);
    throw new ApiUnavailableError(vehicleNo, err.message);
  }
}

module.exports = {
  fetchVehicleData,
  getToken,
  clearToken,
  parseVehicleData,
  InvalidVehicleError,
  ApiUnavailableError,
};
