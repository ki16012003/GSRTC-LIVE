const express = require('express');
const settingsService = require('../services/settingsService');
const logService = require('../services/logService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(settingsService.getSettings());
});

router.put('/', (req, res) => {
  const updated = settingsService.updateSettings(req.body || {});
  logService.log('settings', 'info', `Settings updated: ${JSON.stringify(req.body)}`);
  res.json(updated);
});

module.exports = router;
