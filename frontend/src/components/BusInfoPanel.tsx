"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Compass,
  ExternalLink,
  Gauge,
  MapPin,
  Navigation,
  RouteIcon,
  Warehouse,
  X,
} from "lucide-react";
import type { Bus } from "@/lib/types";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BusInfoPanelProps {
  bus: Bus | null;
  onClose: () => void;
}

export default function BusInfoPanel({ bus, onClose }: BusInfoPanelProps) {
  return (
    <AnimatePresence>
      {bus && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.97 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-auto absolute left-3 right-3 top-[210px] z-20 w-auto lg:left-auto lg:right-4 lg:top-24 lg:w-80"
        >
          <Card className="overflow-hidden rounded-2xl p-0">
            <div className="relative bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent p-5 pb-4">
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <CardTitle className="text-lg">{bus.vehicle_no}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-white/50">Bus #{bus.bus_no || "—"}</span>
                <Badge variant={bus.status as "moving" | "idle" | "stopped" | "offline"}>{bus.status}</Badge>
              </div>
            </div>

            <CardContent className="space-y-1 pt-3">
              <InfoRow icon={RouteIcon} label="Route" value={bus.route_name || "—"} />
              <InfoRow icon={Gauge} label="Speed" value={`${bus.speed} km/h`} />
              <InfoRow icon={Navigation} label="Direction" value={bus.direction || "—"} />
              <InfoRow icon={Warehouse} label="Depot" value={bus.depot_name || "—"} />
              <InfoRow icon={Compass} label="Latitude" value={bus.latitude?.toFixed(6) ?? "—"} />
              <InfoRow icon={Compass} label="Longitude" value={bus.longitude?.toFixed(6) ?? "—"} />
              <InfoRow
                icon={MapPin}
                label="Last Update"
                value={bus.last_update ? new Date(bus.last_update).toLocaleString() : "—"}
              />

              {bus.latitude != null && bus.longitude != null && (
                <Button asChild className="mt-4 w-full" size="sm">
                  <a
                    href={`https://www.google.com/maps?q=${bus.latitude},${bus.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04]">
      <span className="flex items-center gap-2 text-white/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
