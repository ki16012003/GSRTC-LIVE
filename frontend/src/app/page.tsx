"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeafletMapHandle } from "@/components/map/LeafletMap";
import TopBar from "@/components/TopBar";
import BusInfoPanel from "@/components/BusInfoPanel";
import { getBuses, getSettings, getStats } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Bus, Settings, Stats } from "@/lib/types";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b0f1a] text-white/40">
      Loading map…
    </div>
  ),
});

export default function HomePage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<LeafletMapHandle>(null);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    getBuses().then(setBuses).catch(() => {});
    getStats().then(setStats).catch(() => {});
    getSettings().then(setSettings).catch(() => {});

    const socket = getSocket();

    socket.on("bus:update", (bus: Bus) => {
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b.vehicle_no === bus.vehicle_no);
        if (idx === -1) return [...prev, bus];
        const next = [...prev];
        next[idx] = bus;
        return next;
      });
    });

    socket.on("bus:added", (added: Bus[]) => {
      setBuses((prev) => [...prev, ...added.filter((a) => !prev.some((b) => b.vehicle_no === a.vehicle_no))]);
    });

    socket.on("bus:removed", (vehicleNos: string[]) => {
      setBuses((prev) => prev.filter((b) => !vehicleNos.includes(b.vehicle_no)));
    });

    socket.on("stats:update", (s: Stats) => setStats(s));

    return () => {
      socket.off("bus:update");
      socket.off("bus:added");
      socket.off("bus:removed");
      socket.off("stats:update");
    };
  }, []);

  const handleSelectBus = useCallback((vehicleNo: string | null) => {
    setSelected(vehicleNo);
    if (vehicleNo) mapRef.current?.flyTo(vehicleNo);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const selectedBus = buses.find((b) => b.vehicle_no === selected) || null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <LeafletMap
        ref={mapRef}
        buses={buses}
        selectedVehicleNo={selected}
        onSelectBus={handleSelectBus}
        darkMode={darkMode}
        mapDefaults={{
          lat: settings?.mapDefaultLat ?? 23.0225,
          lon: settings?.mapDefaultLon ?? 72.5714,
          zoom: settings?.mapDefaultZoom ?? 100000,
        }}
      />
      <TopBar
        stats={stats}
        buses={buses}
        onSelectBus={handleSelectBus}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
      <BusInfoPanel bus={selectedBus} onClose={() => handleSelectBus(null)} />
    </div>
  );
}
