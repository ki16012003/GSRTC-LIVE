const axios = require('axios');
const logger = require('../utils/logger');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_TTL_MS = 5 * 60 * 1000;
const GEOCODE_TIMEOUT_MS = 5000;

// Cache on a coarse ~100m grid so a moving bus doesn't trigger a fresh
// lookup on every poll, keeping us well within Nominatim's usage policy
// (max 1 request/second, no heavy bulk use).
const cache = new Map();

function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function pickPlaceName(address = {}) {
  return (
    address.hamlet ||
    address.village ||
    address.suburb ||
    address.town ||
    address.city_district ||
    address.city ||
    address.county ||
    null
  );
}

/**
 * Resolves coordinates to a place using OpenStreetMap Nominatim (free, no
 * API key). Returns `{ name, address }` where `name` is a short place name
 * (e.g. "Kera") and `address` is the full human-readable address (e.g.
 * "Kera, Bhuj Taluka, Kutch, Gujarat, 370430, India"). Returns null on any
 * failure/miss so callers can fall back to the raw GSRTC location/coordinates.
 */
async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const response = await axios.get(NOMINATIM_URL, {
      params: { lat, lon, format: 'json', zoom: 15, addressdetails: 1, 'accept-language': 'en' },
      headers: { 'User-Agent': 'gsrtc-tracking-bot/1.0' },
      timeout: GEOCODE_TIMEOUT_MS,
    });

    const result = {
      name: pickPlaceName(response.data && response.data.address),
      address: (response.data && response.data.display_name) || null,
    };
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    logger.warn(`Reverse geocode failed for ${lat},${lon}: ${err.message}`);
    return null;
  }
}

module.exports = { reverseGeocode };
