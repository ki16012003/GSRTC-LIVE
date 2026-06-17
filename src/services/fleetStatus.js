const config = require('../config');
const { fetchMultipleVehicles } = require('./gsrtcApi');
const { reverseGeocode } = require('./geocode');
const { findNearestLandmark } = require('./landmarks');
const { getFleet } = require('./fleet');
const logger = require('../utils/logger');

const ROUTE_KEYWORDS = ['bhuj', 'mundra'];

function isBhujMundraRoute(routeName) {
  const lower = String(routeName || '').toLowerCase();
  return ROUTE_KEYWORDS.every((keyword) => lower.includes(keyword));
}

async function enrichVehicle(data) {
  try {
    const place = await reverseGeocode(data.latitude, data.longitude);
    data.placeName = place?.name;
    data.placeAddress = place?.address;
    const landmark = findNearestLandmark(data.latitude, data.longitude);
    data.landmarkName = landmark?.name;
    data.landmarkDistance = landmark?.distanceMeters;
  } catch (err) {
    logger.warn(`enrichVehicle geocode failed: ${err.message}`);
  }
  return data;
}

async function getActiveBhujMundraVehicles() {
  const results = await fetchMultipleVehicles(config.BHUJ_MUNDRA_FLEET, 5);
  const active = [];
  for (const data of results) {
    if (!isBhujMundraRoute(data.routeName)) continue;
    if (String(data.running) !== '1') continue;
    active.push(await enrichVehicle(data));
  }
  return active;
}

async function getFleetLiveData() {
  const fleet = getFleet();
  const vehicleNos = fleet.map((v) => v.vehicleNo);
  if (vehicleNos.length === 0) return [];

  const results = await fetchMultipleVehicles(vehicleNos, 10);
  const labelMap = {};
  for (const v of fleet) labelMap[v.vehicleNo] = v.label || '';

  const vehicles = [];
  for (const data of results) {
    data.label = labelMap[data.vehicleNo] || '';
    vehicles.push(await enrichVehicle(data));
  }
  return vehicles;
}

module.exports = { getActiveBhujMundraVehicles, isBhujMundraRoute, getFleetLiveData };
