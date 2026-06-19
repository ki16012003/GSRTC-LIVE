"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Bus, BusStatus } from "@/lib/types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export interface LeafletMapHandle {
  flyTo: (vehicleNo: string) => void;
  fitAll: () => void;
}

interface LeafletMapProps {
  buses: Bus[];
  selectedVehicleNo: string | null;
  onSelectBus: (vehicleNo: string | null) => void;
  mapDefaults: { lat: number; lon: number; zoom: number };
  darkMode?: boolean;
}

const STATUS_COLOR: Record<BusStatus, string> = {
  moving: "#16a34a",
  idle: "#f59e0b",
  stopped: "#ef4444",
  offline: "#9ca3af",
};

function busDivIcon(status: BusStatus, selected: boolean) {
  const color = selected ? "#2563eb" : STATUS_COLOR[status];
  const pulse = status === "moving" ? '<span class="bus-pulse" style="border-color:' + color + '"></span>' : "";
  return L.divIcon({
    className: "bus-marker-wrap",
    html: `<div class="bus-marker" style="background:${color}">🚌${pulse}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function tooltipHtml(bus: Bus) {
  const route = bus.route_name && bus.route_name !== "N/A" ? bus.route_name : null;
  const short = route && route.length > 18 ? route.slice(0, 17) + "…" : route;
  return `<b>${bus.bus_no || bus.vehicle_no}</b>${short ? `<br><span class="bus-route">${short}</span>` : ""}`;
}

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(
  ({ buses, selectedVehicleNo, onSelectBus, mapDefaults }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const selectedRef = useRef<string | null>(selectedVehicleNo);
    const hasFitRef = useRef(false);

    selectedRef.current = selectedVehicleNo;

    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: false }).setView(
        [mapDefaults.lat, mapDefaults.lon],
        mapDefaults.zoom
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const streetLayer = MAPBOX_TOKEN
        ? L.tileLayer(
            `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
            { tileSize: 512, zoomOffset: -1, maxZoom: 22, attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © OpenStreetMap' }
          )
        : L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 20,
            subdomains: ["a", "b", "c", "d"],
            attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap',
          });
      streetLayer.addTo(map);

      const satelliteLayer = MAPBOX_TOKEN
        ? L.tileLayer(
            `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
            { tileSize: 512, zoomOffset: -1, maxZoom: 22, attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © OpenStreetMap' }
          )
        : L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "© Esri, Maxar, Earthstar Geographics" }
          );

      L.control.layers({ Street: streetLayer, Satellite: satelliteLayer }, undefined, { position: "topright" }).addTo(map);

      map.on("click", () => onSelectBus(null));

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const seen = new Set<string>();

      for (const bus of buses) {
        if (bus.latitude == null || bus.longitude == null) continue;
        seen.add(bus.vehicle_no);

        const isSelected = selectedRef.current === bus.vehicle_no;
        const icon = busDivIcon(bus.status, isSelected);
        const latLng: [number, number] = [bus.latitude, bus.longitude];

        let marker = markersRef.current.get(bus.vehicle_no);
        if (!marker) {
          marker = L.marker(latLng, { icon })
            .addTo(map)
            .bindTooltip(tooltipHtml(bus), {
              permanent: true,
              direction: "top",
              className: `bus-label status-${bus.status}`,
              offset: [0, -20],
            })
            .on("click", () => onSelectBus(bus.vehicle_no));
          markersRef.current.set(bus.vehicle_no, marker);
        } else {
          marker.setLatLng(latLng);
          marker.setIcon(icon);
          marker.setTooltipContent(tooltipHtml(bus));
          const tooltipEl = marker.getTooltip()?.getElement();
          if (tooltipEl) tooltipEl.className = `leaflet-tooltip bus-label status-${bus.status}`;
        }
      }

      for (const [vehicleNo, marker] of markersRef.current) {
        if (!seen.has(vehicleNo)) {
          map.removeLayer(marker);
          markersRef.current.delete(vehicleNo);
        }
      }

      if (!hasFitRef.current && seen.size > 0) {
        hasFitRef.current = true;
        const latLngs = Array.from(markersRef.current.values()).map((m) => m.getLatLng());
        if (latLngs.length === 1) map.setView(latLngs[0], 13);
        else map.fitBounds(L.latLngBounds(latLngs), { padding: [60, 60] });
      }
    }, [buses, onSelectBus]);

    useImperativeHandle(ref, () => ({
      flyTo(vehicleNo: string) {
        const map = mapRef.current;
        const marker = markersRef.current.get(vehicleNo);
        if (!map || !marker) return;
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 1.2 });
      },
      fitAll() {
        const map = mapRef.current;
        if (!map || markersRef.current.size === 0) return;
        const latLngs = Array.from(markersRef.current.values()).map((m) => m.getLatLng());
        if (latLngs.length === 1) map.setView(latLngs[0], 14);
        else map.fitBounds(L.latLngBounds(latLngs), { padding: [60, 60] });
      },
    }));

    return <div ref={containerRef} className="h-full w-full" />;
  }
);

LeafletMap.displayName = "LeafletMap";

export default LeafletMap;
