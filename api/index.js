const express = require('express');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { getActiveBhujMundraVehicles, getFleetLiveData } = require('../src/services/fleetStatus');
const { getToken } = require('../src/services/gsrtcApi');
const { getAllLandmarks } = require('../src/services/landmarks');
const { getFleet } = require('../src/services/fleet');

let app;

function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const user = sep === -1 ? decoded : decoded.slice(0, sep);
    const pass = sep === -1 ? '' : decoded.slice(sep + 1);
    if (safeEqual(user, config.ADMIN_USER) && safeEqual(pass, config.ADMIN_PASS)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="GSRTC Admin"');
  res.status(401).send('Authentication required');
}

async function readFleetFromGitHub() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = config;
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/src/config/fleet.json?ref=${GITHUB_BRANCH}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function triggerVercelDeploy() {
  if (!config.VERCEL_DEPLOY_HOOK) return;
  try {
    await fetch(config.VERCEL_DEPLOY_HOOK, { method: 'POST' });
    logger.info('Vercel deploy hook triggered');
  } catch (err) {
    logger.warn(`Vercel deploy hook failed: ${err.message}`);
  }
}

async function createApp() {
  app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  });

  app.get('/api/bhujmundra', async (req, res) => {
    try {
      const vehicles = await getActiveBhujMundraVehicles();
      res.json({ updatedAt: new Date().toISOString(), vehicles });
    } catch (err) {
      logger.error(`/api/bhujmundra failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch vehicle data' });
    }
  });

  app.get('/api/fleet/live', async (req, res) => {
    try {
      const vehicles = await getFleetLiveData();
      res.json({ updatedAt: new Date().toISOString(), vehicles });
    } catch (err) {
      logger.error(`/api/fleet/live failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch fleet data' });
    }
  });

  app.get('/api/token', async (req, res) => {
    try {
      const token = await getToken();
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get auth token' });
    }
  });

  app.get('/api/fleet/list', async (req, res) => {
    const gh = await readFleetFromGitHub();
    res.json({ vehicles: gh ? gh.vehicles : getFleet() });
  });

  app.get('/api/landmarks', requireAdminAuth, (req, res) => {
    res.json({ landmarks: getAllLandmarks() });
  });

  app.get('/api/fleet', requireAdminAuth, async (req, res) => {
    const gh = await readFleetFromGitHub();
    res.json({ vehicles: gh ? gh.vehicles : getFleet() });
  });

  app.post('/api/fleet', requireAdminAuth, async (req, res) => {
    const { vehicleNo, label } = req.body || {};
    if (!vehicleNo || typeof vehicleNo !== 'string') {
      return res.status(400).json({ error: 'vehicleNo is required' });
    }
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = config;
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return res.status(503).json({
        error: 'GitHub token not configured. Add GITHUB_TOKEN to Vercel env vars.',
      });
    }

    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/config/fleet.json?ref=${GITHUB_BRANCH}`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!getRes.ok) throw new Error('Failed to read fleet.json from GitHub');
      const existing = await getRes.json();
      const content = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));

      const upper = vehicleNo.trim().toUpperCase();
      if (!content.vehicles.some((v) => v.vehicleNo === upper)) {
        content.vehicles.push({ vehicleNo: upper, label: (label || '').trim() });
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/config/fleet.json`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Add bus ${upper}`,
            content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'),
            sha: existing.sha,
            branch: GITHUB_BRANCH,
          }),
        }
      );
      if (!putRes.ok) {
        const errBody = await putRes.json().catch(() => ({}));
        throw new Error(errBody.message || 'GitHub write failed');
      }

      await triggerVercelDeploy();
      res.json({ vehicles: content.vehicles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fleet/:index', requireAdminAuth, async (req, res) => {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = config;
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return res.status(503).json({
        error: 'GitHub token not configured. Add GITHUB_TOKEN to Vercel env vars.',
      });
    }

    const index = Number(req.params.index);
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/config/fleet.json?ref=${GITHUB_BRANCH}`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!getRes.ok) throw new Error('Failed to read fleet.json from GitHub');
      const existing = await getRes.json();
      const content = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));

      if (index < 0 || index >= content.vehicles.length) {
        return res.status(400).json({ error: 'Vehicle index out of range' });
      }
      content.vehicles.splice(index, 1);

      const putRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/config/fleet.json`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Remove bus at index ${index}`,
            content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'),
            sha: existing.sha,
            branch: GITHUB_BRANCH,
          }),
        }
      );
      if (!putRes.ok) {
        const errBody = await putRes.json().catch(() => ({}));
        throw new Error(errBody.message || 'GitHub write failed');
      }

      await triggerVercelDeploy();
      res.json({ vehicles: content.vehicles });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get(['/admin', '/admin.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  });
  app.get('/admin.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.js'));
  });
  app.get('/fleet', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'fleet.html'));
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = async (req, res) => {
  if (!app) {
    app = await createApp();
  }
  return app(req, res);
};
