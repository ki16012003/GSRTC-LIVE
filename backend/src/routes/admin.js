const express = require('express');
const multer = require('multer');
const busService = require('../services/busService');
const importService = require('../services/importService');
const logService = require('../services/logService');
const socket = require('../socket');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function broadcastStats() {
  socket.emitStats({ ...busService.getStats(), lastUpdate: new Date().toISOString() });
}

router.post('/buses/import', (req, res) => {
  const { text, vehicleNos } = req.body;
  const tokens = vehicleNos && Array.isArray(vehicleNos)
    ? vehicleNos
    : importService.extractTokensFromText(String(text || ''));

  if (!tokens.length) return res.status(400).json({ error: 'No vehicle numbers provided' });

  const result = importService.importVehicleNos(tokens);
  logService.log('import', 'info', `Imported ${result.added.length} buses (${result.duplicates.length} duplicates, ${result.invalid.length} invalid)`);

  if (result.added.length) {
    socket.emitBusesAdded(result.added.map((v) => busService.getBusByVehicleNo(v)));
    broadcastStats();
  }
  res.json(result);
});

router.post('/buses/import-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const tokens = await importService.extractTokensFromBuffer(req.file.buffer, req.file.originalname);
    const result = importService.importVehicleNos(tokens);
    logService.log('import', 'info', `Imported ${result.added.length} buses from file "${req.file.originalname}" (${result.duplicates.length} duplicates, ${result.invalid.length} invalid)`);

    if (result.added.length) {
      socket.emitBusesAdded(result.added.map((v) => busService.getBusByVehicleNo(v)));
      broadcastStats();
    }
    res.json(result);
  } catch (err) {
    logService.log('import', 'error', `File import failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to parse file', details: err.message });
  }
});

router.post('/buses/delete', (req, res) => {
  const { vehicleNos } = req.body;
  if (!Array.isArray(vehicleNos) || !vehicleNos.length) {
    return res.status(400).json({ error: 'vehicleNos array required' });
  }
  const count = busService.deleteBuses(vehicleNos);
  logService.log('admin', 'info', `Deleted ${count} buses`);
  socket.emitBusesRemoved(vehicleNos.map(busService.normalizeVehicleNo));
  broadcastStats();
  res.json({ deleted: count });
});

router.post('/buses/enable', (req, res) => {
  const { vehicleNos } = req.body;
  if (!Array.isArray(vehicleNos) || !vehicleNos.length) {
    return res.status(400).json({ error: 'vehicleNos array required' });
  }
  const count = busService.setTracking(vehicleNos, true);
  logService.log('admin', 'info', `Enabled tracking for ${count} buses`);
  broadcastStats();
  res.json({ updated: count });
});

router.post('/buses/disable', (req, res) => {
  const { vehicleNos } = req.body;
  if (!Array.isArray(vehicleNos) || !vehicleNos.length) {
    return res.status(400).json({ error: 'vehicleNos array required' });
  }
  const count = busService.setTracking(vehicleNos, false);
  logService.log('admin', 'info', `Disabled tracking for ${count} buses`);
  broadcastStats();
  res.json({ updated: count });
});

router.get('/logs', (req, res) => {
  const { type, level, limit, offset } = req.query;
  res.json(logService.getLogs({
    type,
    level,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  }));
});

module.exports = router;
