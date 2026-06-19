const db = require('../database/db');

const insertStmt = db.prepare(`
  INSERT INTO buses (vehicle_no, bus_no, tracking_enabled, status, created_at, updated_at)
  VALUES (?, ?, 1, 'offline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

const updateLiveDataStmt = db.prepare(`
  UPDATE buses SET
    bus_no = COALESCE(?, bus_no),
    latitude = ?,
    longitude = ?,
    speed = ?,
    route_name = ?,
    direction = ?,
    depot_name = ?,
    status = ?,
    last_update = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE vehicle_no = ?
`);

const markOfflineStmt = db.prepare(`
  UPDATE buses SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE vehicle_no = ?
`);

function normalizeVehicleNo(raw) {
  return String(raw).trim().toUpperCase().replace(/[\s-]/g, '');
}

function isValidVehicleNo(raw) {
  return /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{3,4}$/.test(normalizeVehicleNo(raw));
}

function getAllBuses() {
  return db.prepare('SELECT * FROM buses ORDER BY vehicle_no ASC').all();
}

function getTrackedBuses() {
  return db.prepare('SELECT * FROM buses WHERE tracking_enabled = 1').all();
}

function getBusByVehicleNo(vehicleNo) {
  return db.prepare('SELECT * FROM buses WHERE vehicle_no = ?').get(normalizeVehicleNo(vehicleNo));
}

function searchBuses(query) {
  const q = `%${query.trim()}%`;
  return db
    .prepare(`
      SELECT * FROM buses
      WHERE vehicle_no LIKE ? OR bus_no LIKE ? OR route_name LIKE ? OR depot_name LIKE ?
      ORDER BY vehicle_no ASC
    `)
    .all(q, q, q, q);
}

function addBuses(vehicleNos) {
  const added = [];
  const duplicates = [];
  const invalid = [];

  const tx = db.transaction((list) => {
    for (const raw of list) {
      const vehicleNo = normalizeVehicleNo(raw);
      if (!vehicleNo) continue;
      if (!isValidVehicleNo(vehicleNo)) {
        invalid.push(raw);
        continue;
      }
      const existing = db.prepare('SELECT id FROM buses WHERE vehicle_no = ?').get(vehicleNo);
      if (existing) {
        duplicates.push(vehicleNo);
        continue;
      }
      insertStmt.run(vehicleNo, vehicleNo.slice(-5));
      added.push(vehicleNo);
    }
  });
  tx(vehicleNos);

  return { added, duplicates, invalid };
}

function deleteBuses(vehicleNos) {
  const normalized = vehicleNos.map(normalizeVehicleNo);
  const tx = db.transaction((list) => {
    const stmt = db.prepare('DELETE FROM buses WHERE vehicle_no = ?');
    for (const v of list) stmt.run(v);
  });
  tx(normalized);
  return normalized.length;
}

function setTracking(vehicleNos, enabled) {
  const normalized = vehicleNos.map(normalizeVehicleNo);
  const tx = db.transaction((list) => {
    const stmt = db.prepare('UPDATE buses SET tracking_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE vehicle_no = ?');
    for (const v of list) stmt.run(enabled ? 1 : 0, v);
  });
  tx(normalized);
  return normalized.length;
}

function updateLiveData(vehicleNo, data, status) {
  updateLiveDataStmt.run(
    data.busNo,
    data.latitude,
    data.longitude,
    data.speed,
    data.routeName,
    data.direction,
    data.depotName,
    status,
    normalizeVehicleNo(vehicleNo)
  );
  return getBusByVehicleNo(vehicleNo);
}

function markOffline(vehicleNo) {
  markOfflineStmt.run(normalizeVehicleNo(vehicleNo));
  return getBusByVehicleNo(vehicleNo);
}

function getStats() {
  const total = db.prepare('SELECT COUNT(*) c FROM buses').get().c;
  const tracked = db.prepare('SELECT COUNT(*) c FROM buses WHERE tracking_enabled = 1').get().c;
  const byStatus = db.prepare('SELECT status, COUNT(*) c FROM buses GROUP BY status').all();
  const statusMap = { moving: 0, idle: 0, stopped: 0, offline: 0 };
  for (const row of byStatus) statusMap[row.status] = row.c;
  return {
    total,
    tracked,
    online: statusMap.moving + statusMap.idle + statusMap.stopped,
    offline: statusMap.offline,
    moving: statusMap.moving,
    idle: statusMap.idle,
    stopped: statusMap.stopped,
  };
}

module.exports = {
  normalizeVehicleNo,
  isValidVehicleNo,
  getAllBuses,
  getTrackedBuses,
  getBusByVehicleNo,
  searchBuses,
  addBuses,
  deleteBuses,
  setTracking,
  updateLiveData,
  markOffline,
  getStats,
};
