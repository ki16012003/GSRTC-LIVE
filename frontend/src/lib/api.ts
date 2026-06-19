import type { Bus, ImportResult, LogEntry, Settings, Stats } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface AdminAuth {
  user: string;
  pass: string;
}

function authHeader(auth: AdminAuth): Record<string, string> {
  const token = btoa(`${auth.user}:${auth.pass}`);
  return { Authorization: `Basic ${token}` };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getBuses(): Promise<Bus[]> {
  return handle(await fetch(`${API_URL}/api/buses`, { cache: "no-store" }));
}

export async function searchBuses(query: string): Promise<Bus[]> {
  return handle(await fetch(`${API_URL}/api/buses/search?q=${encodeURIComponent(query)}`, { cache: "no-store" }));
}

export async function getStats(): Promise<Stats> {
  return handle(await fetch(`${API_URL}/api/stats`, { cache: "no-store" }));
}

export async function getSettings(): Promise<Settings> {
  return handle(await fetch(`${API_URL}/api/settings`, { cache: "no-store" }));
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return handle(
    await fetch(`${API_URL}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function importBusesText(text: string, auth: AdminAuth): Promise<ImportResult> {
  return handle(
    await fetch(`${API_URL}/api/admin/buses/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(auth) },
      body: JSON.stringify({ text }),
    })
  );
}

export async function importBusesFile(file: File, auth: AdminAuth): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  return handle(
    await fetch(`${API_URL}/api/admin/buses/import-file`, {
      method: "POST",
      headers: authHeader(auth),
      body: form,
    })
  );
}

export async function deleteBuses(vehicleNos: string[], auth: AdminAuth): Promise<{ deleted: number }> {
  return handle(
    await fetch(`${API_URL}/api/admin/buses/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(auth) },
      body: JSON.stringify({ vehicleNos }),
    })
  );
}

export async function setBusTracking(
  vehicleNos: string[],
  enabled: boolean,
  auth: AdminAuth
): Promise<{ updated: number }> {
  return handle(
    await fetch(`${API_URL}/api/admin/buses/${enabled ? "enable" : "disable"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(auth) },
      body: JSON.stringify({ vehicleNos }),
    })
  );
}

export async function getLogs(auth: AdminAuth): Promise<LogEntry[]> {
  return handle(
    await fetch(`${API_URL}/api/admin/logs`, {
      headers: authHeader(auth),
      cache: "no-store",
    })
  );
}

export async function verifyAdminAuth(auth: AdminAuth): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/admin/logs?limit=1`, { headers: authHeader(auth) });
  return res.ok;
}
