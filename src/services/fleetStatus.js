const config = require('../config');
const { fetchVehicleData } = require('./gsrtcApi');
const { reverseGeocode } = require('./geocode');
const { findNearestLandmark } = require('./landmarks');
const { getFleet } = require('./fleet');
const logger = require('../utils/logger');

const ROUTE_KEYWORDS = ['bhuj', 'mundra'];

function isBhujMundraRoute(routeName) {
  const lower = String(routeName || '').toLowerCase();
  return ROUTE_KEYWORDS.every((keyword) => lower.includes(keyword));
}

async function getActiveBhujMundraVehicles() {
  const active = [];
  for (const vehicleNo of config.BHUJ_MUNDRA_FLEET) {
    try {
      const data = await fetchVehicleData(vehicleNo);
      if (!isBhujMundraRoute(data.routeName)) continue;
      if (String(data.running) !== '1') continue;
      const place = await reverseGeocode(data.latitude, data.longitude);
      data.placeName = place && place.name;
      data.placeAddress = place && place.address;
      const landmark = findNearestLandmark(data.latitude, data.longitude);
      data.landmarkName = landmark && landmark.name;
      data.landmarkDistance = landmark && landmark.distanceMeters;
      active.push(data);
    } catch (err) {
      logger.warn(`fleetStatus: failed to fetch ${vehicleNo}: ${err.message}`);
    }
  }
  return active;
}

async function getFleetLiveData() {
  const vehicles = [];
  for (const { vehicleNo, label } of getFleet()) {
    try {
      const data = await fetchVehicleData(vehicleNo);
      data.label = label || '';
      const place = await reverseGeocode(data.latitude, data.longitude);
      data.placeName = place && place.name;
      data.placeAddress = place && place.address;
      const landmark = findNearestLandmark(data.latitude, data.longitude);
      data.landmarkName = landmark && landmark.name;
      data.landmarkDistance = landmark && landmark.distanceMeters;
      vehicles.push(data);
    } catch (err) {
      logger.warn(`fleetStatus: failed to fetch ${vehicleNo}: ${err.message}`);
    }
  }
  return vehicles;
}

module.exports = { getActiveBhujMundraVehicles, isBhujMundraRoute, getFleetLiveData };
