export type BusStatus = "moving" | "idle" | "stopped" | "offline";

export interface Bus {
  id: number;
  vehicle_no: string;
  bus_no: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number;
  route_name: string | null;
  direction: string | null;
  depot_name: string | null;
  status: BusStatus;
  last_update: string | null;
  tracking_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  tracked: number;
  online: number;
  offline: number;
  moving: number;
  idle: number;
  stopped: number;
  lastUpdate: string;
}

export interface Settings {
  trackIntervalSeconds: number;
  workerCount: number;
  apiMaxRetries: number;
  apiTimeout: number;
  offlineAfterSeconds: number;
  idleSpeedThreshold: number;
  stoppedAfterSeconds: number;
  mapDefaultLat: number;
  mapDefaultLon: number;
  mapDefaultZoom: number;
  theme: string;
}

export interface ImportResult {
  added: string[];
  duplicates: string[];
  invalid: string[];
}

export interface LogEntry {
  id: number;
  type: string;
  level: string;
  message: string;
  vehicle_no: string | null;
  created_at: string;
}
