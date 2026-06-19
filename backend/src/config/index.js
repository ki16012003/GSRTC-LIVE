require('dotenv').config();

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  PORT: toInt(process.env.PORT, 4000),
  NODE_ENV: process.env.NODE_ENV || 'production',

  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, '..', '..', 'database', 'gsrtc.db'),

  GSRTC_LOGIN_URL: process.env.GSRTC_LOGIN_URL || 'https://live.gsrtc.org/api/auth/login',
  GSRTC_API_URL: process.env.GSRTC_API_URL || 'https://live.gsrtc.org/api/vehicle/tooltip',
  GSRTC_USERNAME: process.env.GSRTC_USERNAME || 'Amnex_Admin',
  GSRTC_PASSWORD: process.env.GSRTC_PASSWORD || 'Amnex@123',

  TRACK_INTERVAL_SECONDS: toInt(process.env.TRACK_INTERVAL_SECONDS, 4),
  WORKER_COUNT: toInt(process.env.WORKER_COUNT, 8),
  API_MAX_RETRIES: toInt(process.env.API_MAX_RETRIES, 3),
  API_RETRY_DELAY: toInt(process.env.API_RETRY_DELAY, 1500),
  API_TIMEOUT: toInt(process.env.API_TIMEOUT, 10000),

  OFFLINE_AFTER_SECONDS: toInt(process.env.OFFLINE_AFTER_SECONDS, 120),
  IDLE_SPEED_THRESHOLD: toInt(process.env.IDLE_SPEED_THRESHOLD, 5),
  STOPPED_AFTER_SECONDS: toInt(process.env.STOPPED_AFTER_SECONDS, 300),

  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'admin',

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
