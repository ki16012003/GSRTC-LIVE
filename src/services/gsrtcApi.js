const axios = require('axios');
const https = require('https');
const config = require('../config');
const logger = require('../utils/logger');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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
  return {
    vehicleNo: raw.vehicleNo,
    busNo: raw.busNo,
    latitude: parseFloat(raw.latitude),
    longitude: parseFloat(raw.longitude),
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

/**
 * Fetches the latest tooltip data for a vehicle from the GSRTC live API,
 * retrying transient failures automatically.
 *
 * @throws {InvalidVehicleError} if the vehicle number doesn't exist / has no live data
 * @throws {ApiUnavailableError} if the API is unreachable after all retries
 */
async function fetchVehicleData(vehicleNo, attempt = 1) {
  try {
    const response = await axios.post(
      config.GSRTC_API_URL,
      { vehicleNo },
      {
        timeout: config.API_TIMEOUT,
        headers: { 'Content-Type': 'application/json' },
        httpsAgent,
      }
    );

    const data = response.data;

    if (!data || data.latitude == null || data.longitude == null || isNaN(parseFloat(data.latitude))) {
      throw new InvalidVehicleError(vehicleNo);
    }

    return parseVehicleData(data);
  } catch (err) {
    if (err instanceof InvalidVehicleError) {
      throw err;
    }

    // 404 / 400 style responses usually mean the vehicle doesn't exist.
    if (err.response && (err.response.status === 404 || err.response.status === 400)) {
      throw new InvalidVehicleError(vehicleNo);
    }

    if (attempt < config.API_MAX_RETRIES) {
      logger.warn(
        `GSRTC API call failed for ${vehicleNo} (attempt ${attempt}/${config.API_MAX_RETRIES}): ${err.message}. Retrying...`
      );
      await sleep(config.API_RETRY_DELAY * attempt);
      return fetchVehicleData(vehicleNo, attempt + 1);
    }

    logger.error(`GSRTC API call failed for ${vehicleNo} after ${config.API_MAX_RETRIES} attempts: ${err.message}`);
    throw new ApiUnavailableError(vehicleNo, err.message);
  }
}

module.exports = { fetchVehicleData, InvalidVehicleError, ApiUnavailableError };
