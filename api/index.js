const express = require('express');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { getActiveBhujMundraVehicles, getFleetLiveData } = require('../src/services/fleetStatus');
const { getAllLandmarks, addLandmark, removeLandmark } = require('../src/services/landmarks');
const { getFleet, addVehicle, removeVehicle } = require('../src/services/fleet');

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

  app.get('/api/landmarks', requireAdminAuth, (req, res) => {
    res.json({ landmarks: getAllLandmarks() });
  });

  app.post('/api/landmarks', requireAdminAuth, async (req, res) => {
    const { name, latitude, longitude, radiusMeters } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude must be numbers' });
    }
    try {
      const landmarks = addLandmark({ name: name.trim(), latitude, longitude, radiusMeters });
      await pushToGitHub('landmarks.json');
      res.json({ landmarks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/landmarks/:index', requireAdminAuth, async (req, res) => {
    const index = Number(req.params.index);
    try {
      const landmarks = removeLandmark(index);
      await pushToGitHub('landmarks.json');
      res.json({ landmarks });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/fleet', requireAdminAuth, (req, res) => {
    res.json({ vehicles: getFleet() });
  });

  app.post('/api/fleet', requireAdminAuth, async (req, res) => {
    const { vehicleNo, label } = req.body || {};
    if (!vehicleNo || typeof vehicleNo !== 'string') {
      return res.status(400).json({ error: 'vehicleNo is required' });
    }
    try {
      const vehicles = addVehicle({ vehicleNo, label });
      await pushToGitHub('fleet.json');
      res.json({ vehicles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fleet/:index', requireAdminAuth, async (req, res) => {
    const index = Number(req.params.index);
    try {
      const vehicles = removeVehicle(index);
      await pushToGitHub('fleet.json');
      res.json({ vehicles });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get(['/admin.html', '/admin.js'], requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', req.path));
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

async function pushToGitHub(fileName) {
  const token = config.GITHUB_TOKEN;
  const repo = config.GITHUB_REPO;
  const branch = config.GITHUB_BRANCH || 'main';
  if (!token || !repo) return;

  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', 'src', 'config', fileName);
  const content = fs.readFileSync(filePath, 'utf8');

  let sha = null;
  try {
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/src/config/${fileName}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch { }

  await fetch(`https://api.github.com/repos/${repo}/contents/src/config/${fileName}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: `Update ${fileName}`,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    }),
  });
}

module.exports = async (req, res) => {
  if (!app) {
    app = await createApp();
  }
  return app(req, res);
};
