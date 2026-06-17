const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const FLEET_PATH = path.join(__dirname, '..', 'config', 'fleet.json');

function loadFile() {
  try {
    const raw = fs.readFileSync(FLEET_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.vehicles)) parsed.vehicles = [];
    return parsed;
  } catch (err) {
    logger.warn(`Failed to load fleet.json: ${err.message}`);
    return { vehicles: [] };
  }
}

function saveFile(data) {
  fs.writeFileSync(FLEET_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getFleet() {
  return loadFile().vehicles;
}

function addVehicle({ vehicleNo, label }) {
  const data = loadFile();
  const upper = vehicleNo.trim().toUpperCase();
  if (data.vehicles.some((v) => v.vehicleNo === upper)) {
    return data.vehicles;
  }
  data.vehicles.push({ vehicleNo: upper, label: (label || '').trim() });
  saveFile(data);
  return data.vehicles;
}

function removeVehicle(index) {
  const data = loadFile();
  if (index < 0 || index >= data.vehicles.length) {
    throw new Error('Vehicle index out of range');
  }
  data.vehicles.splice(index, 1);
  saveFile(data);
  return data.vehicles;
}

module.exports = { getFleet, addVehicle, removeVehicle };
