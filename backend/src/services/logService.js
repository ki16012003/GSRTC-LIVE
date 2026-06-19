const db = require('../database/db');
const logger = require('../utils/logger');

const insertStmt = db.prepare(
  'INSERT INTO logs (type, level, message, vehicle_no) VALUES (?, ?, ?, ?)'
);

function log(type, level, message, vehicleNo = null) {
  try {
    insertStmt.run(type, level, message, vehicleNo);
  } catch (err) {
    logger.error(`Failed to write log to database: ${err.message}`);
  }
  if (level === 'error') logger.error(message);
  else if (level === 'warn') logger.warn(message);
  else logger.info(message);
}

function getLogs({ type, level, limit = 200, offset = 0 } = {}) {
  const clauses = [];
  const params = [];
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (level) {
    clauses.push('level = ?');
    params.push(level);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return rows;
}

function pruneLogs(keepDays = 14) {
  db.prepare("DELETE FROM logs WHERE created_at < datetime('now', ?)").run(`-${keepDays} days`);
}

module.exports = { log, getLogs, pruneLogs };
