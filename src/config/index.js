require('dotenv').config();

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  GSRTC_API_URL: process.env.GSRTC_API_URL || 'https://live.gsrtc.org/api/vehicle/tooltip',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  API_MAX_RETRIES: toInt(process.env.API_MAX_RETRIES, 3),
  API_RETRY_DELAY: toInt(process.env.API_RETRY_DELAY, 2000),
  API_TIMEOUT: toInt(process.env.API_TIMEOUT, 10000),
  BHUJ_MUNDRA_FLEET: (process.env.BHUJ_MUNDRA_FLEET || 'GJ18Z6224')
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean),
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'admin',
  GITHUB_REPO: process.env.GITHUB_REPO || '',
};

module.exports = config;
