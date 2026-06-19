"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bus as BusIcon,
  CheckCircle2,
  ClipboardPaste,
  Power,
  PowerOff,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import AdminLoginGate from "@/components/AdminLoginGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  deleteBuses,
  getBuses,
  importBusesFile,
  importBusesText,
  setBusTracking,
  type AdminAuth,
} from "@/lib/api";
import type { Bus, ImportResult } from "@/lib/types";

export default function AdminPage() {
  return <AdminLoginGate>{(auth) => <AdminConsole auth={auth} />}</AdminLoginGate>;
}

function AdminConsole({ auth }: { auth: AdminAuth }) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    getBuses().then(setBuses).catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handlePasteImport() {
    if (!pasteText.trim()) return;
    setBusy(true);
    try {
      const result = await importBusesText(pasteText, auth);
      setImportResult(result);
      setPasteText("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleFileImport(file: File) {
    setBusy(true);
    try {
      const result = await importBusesFile(file, auth);
      setImportResult(result);
      refresh();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleSelect(vehicleNo: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleNo)) next.delete(vehicleNo);
      else next.add(vehicleNo);
      return next;
    });
  }

  async function bulkAction(action: "enable" | "disable" | "delete") {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const list = Array.from(selected);
      if (action === "delete") await deleteBuses(list, auth);
      else await setBusTracking(list, action === "enable", auth);
      setSelected(new Set());
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleOne(vehicleNo: string, enabled: boolean) {
    await setBusTracking([vehicleNo], enabled, auth);
    refresh();
  }

  const filtered = buses.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.vehicle_no.toLowerCase().includes(q) ||
      (b.bus_no || "").toLowerCase().includes(q) ||
      (b.route_name || "").toLowerCase().includes(q) ||
      (b.depot_name || "").toLowerCase().includes(q)
    );
  });

  const movingCount = buses.filter((b) => b.status === "moving").length;
  const trackedCount = buses.filter((b) => !!b.tracking_enabled).length;

  return (
    <div className="min-h-screen app-bg p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
              <BusIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Bus Management</h1>
              <p className="text-xs text-white/40">Import, track, and manage your fleet</p>
            </div>
          </div>
          <Link href="/" className="shrink-0">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <ArrowLeft className="h-4 w-4" /> Back to map
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <MiniStat label="Total Buses" value={buses.length} />
          <MiniStat label="Tracking Enabled" value={trackedCount} color="text-green-400" />
          <MiniStat label="Currently Moving" value={movingCount} color="text-blue-400" />
        </div>

        <Tabs defaultValue="import">
          <TabsList>
            <TabsTrigger value="import">Bulk Import</TabsTrigger>
            <TabsTrigger value="manage">Manage Buses ({buses.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 text-blue-400" /> Manual Paste
                </CardTitle>
                <p className="text-xs text-white/40">One vehicle number per line, or comma-separated</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="h-32 w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm outline-none transition-colors focus-visible:border-blue-500/50 focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  placeholder={"GJ18Z6224\nGJ18Z5511\nGJ18Z9001"}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button onClick={handlePasteImport} disabled={busy || !pasteText.trim()}>
                  Import Vehicle Numbers
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-violet-400" /> File Upload
                </CardTitle>
                <p className="text-xs text-white/40">TXT, CSV, or Excel (.xlsx / .xls)</p>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileImport(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragOver
                      ? "border-blue-400/60 bg-blue-500/10"
                      : "border-white/15 hover:border-white/25 hover:bg-white/[0.03]"
                  }`}
                >
                  <Upload className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/70">
                    Drop a file here, or <span className="text-blue-400">browse</span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls"
                    onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            {importResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Last Import Result</CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-3 text-sm">
                    <span className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-green-400 ring-1 ring-inset ring-green-500/25">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Added {importResult.added.length}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-yellow-400 ring-1 ring-inset ring-yellow-500/25">
                      Duplicates {importResult.duplicates.length}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-red-400 ring-1 ring-inset ring-red-500/25">
                      <XCircle className="h-3.5 w-3.5" /> Invalid {importResult.invalid.length}
                    </span>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="manage">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search vehicle, route, depot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex-1" />
              {selected.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-white/40">{selected.size} selected</span>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => bulkAction("enable")}>
                    <Power className="h-3.5 w-3.5" /> Enable
                  </Button>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => bulkAction("disable")}>
                    <PowerOff className="h-3.5 w-3.5" /> Disable
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => bulkAction("delete")}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </motion.div>
              )}
            </div>

            <Card className="overflow-hidden">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/35">
                      <th className="w-10 p-3"></th>
                      <th className="p-3 font-medium">Vehicle No</th>
                      <th className="p-3 font-medium">Bus No</th>
                      <th className="p-3 font-medium">Route</th>
                      <th className="p-3 font-medium">Depot</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((bus) => (
                      <tr
                        key={bus.vehicle_no}
                        className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(bus.vehicle_no)}
                            onChange={() => toggleSelect(bus.vehicle_no)}
                            className="h-4 w-4 accent-blue-500"
                          />
                        </td>
                        <td className="p-3 font-medium">{bus.vehicle_no}</td>
                        <td className="p-3 text-white/70">{bus.bus_no || "—"}</td>
                        <td className="p-3 text-white/60">{bus.route_name || "—"}</td>
                        <td className="p-3 text-white/60">{bus.depot_name || "—"}</td>
                        <td className="p-3">
                          <Badge variant={bus.status as "moving" | "idle" | "stopped" | "offline"}>
                            {bus.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Switch
                            checked={!!bus.tracking_enabled}
                            onCheckedChange={(checked) => toggleOne(bus.vehicle_no, checked)}
                          />
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-white/30">
                          No buses found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-white/35">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${color || "text-white"}`}>{value}</p>
    </Card>
  );
}
