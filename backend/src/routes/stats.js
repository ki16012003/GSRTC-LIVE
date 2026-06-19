const express = require('express');
const busService = require('../services/busService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ ...busService.getStats(), lastUpdate: new Date().toISOString() });
});

module.exports = router;
