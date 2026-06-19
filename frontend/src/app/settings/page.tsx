"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Gauge, Map as MapIcon, Radio, Settings as SettingsIcon } from "lucide-react";
import AdminLoginGate from "@/components/AdminLoginGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings } from "@/lib/api";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  return <AdminLoginGate>{() => <SettingsForm />}</AdminLoginGate>;
}

type FieldDef = { key: keyof Settings; label: string; hint: string };

const SECTIONS: { title: string; icon: typeof Gauge; fields: FieldDef[] }[] = [
  {
    title: "Tracking Engine",
    icon: Radio,
    fields: [
      { key: "trackIntervalSeconds", label: "Tracking Interval", hint: "Seconds between polling cycles" },
      { key: "workerCount", label: "Worker Count", hint: "Concurrent GSRTC API requests" },
      { key: "apiMaxRetries", label: "Retry Count", hint: "Retries per failed request" },
      { key: "apiTimeout", label: "API Timeout (ms)", hint: "Per-request timeout" },
    ],
  },
  {
    title: "Status Thresholds",
    icon: Gauge,
    fields: [
      { key: "offlineAfterSeconds", label: "Offline After (s)", hint: "No data marks a bus offline" },
      { key: "idleSpeedThreshold", label: "Idle Speed (km/h)", hint: "Below this speed = idle/stopped" },
      { key: "stoppedAfterSeconds", label: "Stopped After (s)", hint: "Low-speed duration before 'stopped'" },
    ],
  },
  {
    title: "Map Defaults",
    icon: MapIcon,
    fields: [
      { key: "mapDefaultLat", label: "Default Latitude", hint: "Initial camera latitude" },
      { key: "mapDefaultLon", label: "Default Longitude", hint: "Initial camera longitude" },
      { key: "mapDefaultZoom", label: "Default Zoom (m)", hint: "Initial camera height" },
    ],
  },
];

function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function setField(key: keyof Settings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: key === "theme" ? value : Number(value) } : prev));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen app-bg p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-6 pb-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
              <SettingsIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Settings</h1>
              <p className="text-xs text-white/40">Tuned live — no restart required</p>
            </div>
          </div>
          <Link href="/" className="shrink-0">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <ArrowLeft className="h-4 w-4" /> Back to map
            </Button>
          </Link>
        </div>

        {!settings ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl glass-panel" />
            ))}
          </div>
        ) : (
          <>
            {SECTIONS.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <section.icon className="h-4 w-4 text-blue-400" /> {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {section.fields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                    >
                      <div>
                        <p className="text-sm font-medium">{field.label}</p>
                        <p className="text-xs text-white/40">{field.hint}</p>
                      </div>
                      <Input
                        type="number"
                        className="w-28 text-right"
                        value={settings[field.key] as number}
                        onChange={(e) => setField(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-blue-400" /> Appearance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-2">
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-white/40">Default map theme</p>
                  </div>
                  <select
                    className="w-32 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    value={settings.theme}
                    onChange={(e) => setField("theme", e.target.value)}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {settings && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl glass-panel px-4 py-3 sm:bottom-6 sm:w-auto sm:flex-nowrap"
        >
          <p className="text-center text-xs text-white/40">Changes apply on the next tracking cycle</p>
          <Button onClick={save} disabled={saving} size="sm">
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : saving ? "Saving..." : "Save Settings"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
