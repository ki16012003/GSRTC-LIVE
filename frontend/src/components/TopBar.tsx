"use client";

import {
  Bus as BusIcon,
  Maximize,
  Minimize,
  Search,
  Settings as SettingsIcon,
  Shield,
  Moon,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Bus, Stats } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopBarProps {
  stats: Stats | null;
  buses: Bus[];
  onSelectBus: (vehicleNo: string) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function TopBar({
  stats,
  buses,
  onSelectBus,
  onToggleFullscreen,
  isFullscreen,
  darkMode,
  onToggleDarkMode,
}: TopBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const results = query.trim()
    ? buses
        .filter((b) => {
          const q = query.toLowerCase();
          return (
            b.vehicle_no.toLowerCase().includes(q) ||
            (b.bus_no || "").toLowerCase().includes(q) ||
            (b.route_name || "").toLowerCase().includes(q) ||
            (b.depot_name || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  function pick(vehicleNo: string) {
    onSelectBus(vehicleNo);
    setQuery("");
    setOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3 lg:flex-nowrap lg:gap-3 lg:p-4"
    >
      <div className="order-1 flex shrink-0 items-center gap-2 rounded-2xl glass-panel px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
          <BusIcon className="h-4 w-4 text-white" />
        </div>
        <span className="hidden text-sm font-semibold tracking-tight text-white/90 md:inline">
          GSRTC <span className="text-gradient">Live</span>
        </span>
      </div>

      <div className="order-4 flex w-full items-center gap-2 overflow-x-auto rounded-2xl glass-panel px-2 py-2 lg:order-2 lg:w-auto lg:flex-1">
        <Stat label="Tracked" value={stats?.total ?? "—"} dotClass="bg-white/50" />
        <Divider />
        <Stat label="Online" value={stats?.online ?? "—"} color="text-green-400" dotClass="bg-green-400" />
        <Divider />
        <Stat label="Offline" value={stats?.offline ?? "—"} color="text-gray-400" dotClass="bg-gray-400" />
        <Divider />
        <Stat label="Moving" value={stats?.moving ?? "—"} color="text-blue-400" dotClass="bg-blue-400 animate-pulse" />
        <Divider />
        <Stat
          label="Updated"
          value={stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString() : "—"}
          color="text-white/70"
        />
      </div>

      <div ref={searchRef} className="order-2 relative min-w-[140px] flex-1 lg:order-3 lg:w-72 lg:flex-none">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search vehicle, route, depot…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="h-10 rounded-2xl pl-9 pr-8 glass-panel border-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute mt-2 w-full overflow-hidden rounded-2xl glass-panel p-1.5"
          >
            {results.map((bus) => (
              <button
                key={bus.vehicle_no}
                onClick={() => pick(bus.vehicle_no)}
                className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/[0.08]"
              >
                <span className="font-medium">
                  {bus.vehicle_no} <span className="text-white/40">· {bus.bus_no}</span>
                </span>
                <span className="text-xs text-white/45">
                  {bus.route_name || "No route"} · {bus.depot_name || "—"}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="order-3 flex shrink-0 items-center gap-1 rounded-2xl glass-panel p-1.5 lg:order-4">
        <Button variant="ghost" size="icon" onClick={onToggleDarkMode} title="Toggle dark mode" className="rounded-xl">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleFullscreen} title="Fullscreen" className="rounded-xl">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Link href="/admin">
          <Button variant="ghost" size="icon" title="Admin" className="rounded-xl">
            <Shield className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost" size="icon" title="Settings" className="rounded-xl">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function Divider() {
  return <span className="h-7 w-px shrink-0 bg-white/10" />;
}

function Stat({
  label,
  value,
  color,
  dotClass,
}: {
  label: string;
  value: string | number;
  color?: string;
  dotClass?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5">
      {dotClass && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">{label}</span>
        <span className={cn("text-sm font-semibold leading-tight", color || "text-white")}>{value}</span>
      </div>
    </div>
  );
}
