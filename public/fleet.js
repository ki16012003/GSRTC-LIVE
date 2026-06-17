const GSRTC_API = 'https://live.gsrtc.org/api/vehicle/tooltip';

const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

const markers = new Map();
const statusEl = document.getElementById('status');

let authToken = null;

function vehicleStatus(v) {
  if (String(v.nocomm) === '1') return 'nosignal';
  if (Number(v.speed) > 0 || String(v.running) === '1') return 'running';
  return 'idle';
}

async function fetchToken() {
  const res = await fetch('/api/token');
  if (!res.ok) throw new Error('Failed to get token');
  const data = await res.json();
  authToken = data.token;
}

async function fetchVehicleData(vehicleNo) {
  const res = await fetch(GSRTC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ vehicleNo }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function refresh() {
  if (!authToken) {
    try { await fetchToken(); } catch { return; }
  }

  const listRes = await fetch('/api/fleet/list');
  if (!listRes.ok) return;
  const { vehicles: fleet } = await listRes.json();

  const results = await Promise.allSettled(
    fleet.map((v) => fetchVehicleData(v.vehicleNo))
  );

  const seen = new Set();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) continue;
    const raw = r.value;
    const lat = parseFloat(raw.latitude);
    const lon = parseFloat(raw.longitude);
    if (isNaN(lat) || isNaN(lon)) continue;

    seen.add(raw.vehicleNo);
    const label = fleet[i].label || '';
    const latLng = [lat, lon];
    const status = vehicleStatus(raw);
    const displayLabel = label || raw.busNo || raw.vehicleNo;

    if (markers.has(raw.vehicleNo)) {
      const marker = markers.get(raw.vehicleNo);
      marker.setLatLng(latLng);
      marker.setPopupContent(popupHtml(raw, label));
      marker.setTooltipContent(displayLabel);
    } else {
      const marker = L.marker(latLng)
        .addTo(map)
        .bindPopup(popupHtml(raw, label))
        .bindTooltip(displayLabel, {
          permanent: true, direction: 'top',
          className: `bus-label ${status}`, offset: [0, -10],
        });
      markers.set(raw.vehicleNo, marker);
    }
  }

  for (const [vehicleNo, marker] of markers) {
    if (!seen.has(vehicleNo)) {
      map.removeLayer(marker);
      markers.delete(vehicleNo);
    }
  }

  const time = new Date().toLocaleTimeString();
  statusEl.textContent = `${markers.size} bus(es) tracked — ${time}`;
}

function popupHtml(v, label) {
  const where = v.location || `${v.latitude}, ${v.longitude}`;
  return (
    `<b>${label || v.busNo || v.vehicleNo}</b> (${v.vehicleNo})<br>` +
    `${where}<br>` +
    `Speed: ${v.speed || 0} km/h<br>` +
    `Route: ${v.routeName || 'N/A'}<br>` +
    `Depot: ${v.depotName || 'N/A'}<br>` +
    `Updated: ${v.receivedDate || 'N/A'}`
  );
}

refresh();
setInterval(refresh, 30000);
