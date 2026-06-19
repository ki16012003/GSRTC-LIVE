const express = require('express');
const busService = require('../services/busService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(busService.getAllBuses());
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json(busService.getAllBuses());
  res.json(busService.searchBuses(q));
});

router.get('/:vehicleNo', (req, res) => {
  const bus = busService.getBusByVehicleNo(req.params.vehicleNo);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  res.json(bus);
});

module.exports = router;
