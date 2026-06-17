const fs = require('fs');
const path = require('path');
const { haversineDistance } = require('../utils/geo');
const logger = require('../utils/logger');

const LANDMARKS_PATH = path.join(__dirname, '..', 'config', 'landmarks.json');
const DEFAULT_RADIUS_METERS = 500;

function loadFile() {
  try {
    const raw = fs.readFileSync(LANDMARKS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.landmarks)) parsed.landmarks = [];
    return parsed;
  } catch (err) {
    logger.warn(`Failed to load landmarks.json: ${err.message}`);
    return { landmarks: [] };
  }
}

function saveFile(data) {
  fs.writeFileSync(LANDMARKS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getAllLandmarks() {
  return loadFile().landmarks;
}

function addLandmark({ name, latitude, longitude, radiusMeters }) {
  const data = loadFile();
  data.landmarks.push({
    name, latitude, longitude,
    radiusMeters: radiusMeters || DEFAULT_RADIUS_METERS,
  });
  saveFile(data);
  return data.landmarks;
}

function removeLandmark(index) {
  const data = loadFile();
  if (index < 0 || index >= data.landmarks.length) {
    throw new Error('Landmark index out of range');
  }
  data.landmarks.splice(index, 1);
  saveFile(data);
  return data.landmarks;
}

function findNearestLandmark(lat, lon) {
  const landmarks = loadFile().landmarks.filter((l) => l.latitude != null && l.longitude != null);
  let nearest = null;
  let nearestDist = Infinity;
  for (const landmark of landmarks) {
    const dist = haversineDistance(lat, lon, landmark.latitude, landmark.longitude);
    const radius = landmark.radiusMeters || DEFAULT_RADIUS_METERS;
    if (dist <= radius && dist < nearestDist) {
      nearest = landmark;
      nearestDist = dist;
    }
  }
  return nearest ? { name: nearest.name, distanceMeters: Math.round(nearestDist) } : null;
}

module.exports = { findNearestLandmark, getAllLandmarks, addLandmark, removeLandmark };
