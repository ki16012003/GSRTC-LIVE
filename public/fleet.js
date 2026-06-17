// Roughly centers the Bhuj-Mundra route (Kutch district, Gujarat).
const map = L.map('map').setView([23.0, 69.65], 10);

// CartoDB Voyager - clean light style with road labels, closest free
// alternative to Apple Maps (no API key required).
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

const markers = new Map(); // vehicleNo -> marker
const statusEl = document.getElementById('status');

function vehicleStatus(v) {
  if (String(v.nocomm) === '1') return 'nosignal';
  if (Number(v.speed) > 0 || String(v.running) === '1') return 'running';
  return 'idle';
}

function statusLabel(status) {
  if (status === 'running') return 'Running';
  if (status === 'nosignal') return 'No GPS signal';
  return 'Idle';
}

function popupHtml(v) {
  const where = v.landmarkName
    ? `${v.landmarkName} (~${v.landmarkDistance}m)`
    : v.placeAddress || v.placeName || v.location || 'Unknown location';
  return (
    `<b>${v.label || v.busNo || v.vehicleNo}</b> (${v.vehicleNo})<br>` +
    `${where}<br>` +
    `Status: ${statusLabel(vehicleStatus(v))}<br>` +
    `Speed: ${v.speed} km/h<br>` +
    `Route: ${v.routeName || 'N/A'}<br>` +
    `Updated: ${v.receivedDate || 'N/A'}`
  );
}

async function refresh() {
  try {
    const res = await fetch('/api/fleet/live');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const seen = new Set();

    for (const v of data.vehicles) {
      seen.add(v.vehicleNo);
      const latLng = [v.latitude, v.longitude];
      const status = vehicleStatus(v);
      const label = v.label || v.busNo || v.vehicleNo;

      if (markers.has(v.vehicleNo)) {
        const marker = markers.get(v.vehicleNo);
        marker.setLatLng(latLng);
        marker.setPopupContent(popupHtml(v));
        marker.setTooltipContent(label);
        const tooltipEl = marker.getTooltip().getElement();
        if (tooltipEl) {
          tooltipEl.className = `leaflet-tooltip bus-label ${status}`;
        }
      } else {
        const marker = L.marker(latLng)
          .addTo(map)
          .bindPopup(popupHtml(v))
          .bindTooltip(label, {
            permanent: true,
            direction: 'top',
            className: `bus-label ${status}`,
            offset: [0, -10],
          });
        markers.set(v.vehicleNo, marker);
      }
    }

    // Remove markers for buses no longer in the configured fleet.
    for (const [vehicleNo, marker] of markers) {
      if (!seen.has(vehicleNo)) {
        map.removeLayer(marker);
        markers.delete(vehicleNo);
      }
    }

    const time = new Date(data.updatedAt).toLocaleTimeString();
    statusEl.textContent = `${data.vehicles.length} bus(es) tracked — updated ${time}`;
  } catch (err) {
    statusEl.textContent = 'Failed to load fleet data';
  }
}

refresh();
setInterval(refresh, 30000);
