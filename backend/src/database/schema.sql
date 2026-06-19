CREATE TABLE IF NOT EXISTS buses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_no TEXT NOT NULL UNIQUE,
  bus_no TEXT,
  latitude REAL,
  longitude REAL,
  speed REAL DEFAULT 0,
  route_name TEXT,
  direction TEXT,
  depot_name TEXT,
  status TEXT DEFAULT 'offline',
  last_update DATETIME,
  tracking_enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_buses_vehicle_no ON buses(vehicle_no);
CREATE INDEX IF NOT EXISTS idx_buses_tracking_enabled ON buses(tracking_enabled);
CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  vehicle_no TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
