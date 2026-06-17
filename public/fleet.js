const GSRTC_API = 'https://live.gsrtc.org/api/vehicle/tooltip';

const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

const markers = new Map();
const vehicleCache = new Map();
const statusEl = document.getElementById('status');
const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const fitBtn = document.getElementById('fitBtn');

let authToken = null;
let allFleet = [];

function vehicleStatus(v) {
  if (String(v.nocomm) === '1') return 'nosignal';
  if (Number(v.speed) > 0 || String(v.running) === '1') return 'running';
  return 'idle';
}

function formatVehicleNo(v) {
  if (!v) return v;
  const m = v.match(/^([A-Za-z]{2})(\d{1,2})([A-Za-z]{1,2})(\d{1,4})$/);
  return m ? m.slice(1).join('-').toUpperCase() : v;
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

function updateUI() {
  const q = searchInput.value.trim().toLowerCase();
  let visible = 0;

  for (const [vehicleNo, marker] of markers) {
    const v = vehicleCache.get(vehicleNo);
    if (!v) continue;
    const haystack = `${v.vehicleNo} ${v.busNo || ''} ${v.routeName || ''} ${v.depotName || ''} ${v.location || ''}`.toLowerCase();
    const match = !q || haystack.includes(q);

    if (match && !map.hasLayer(marker)) {
      marker.addTo(map);
      visible++;
    } else if (match) {
      visible++;
    } else if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  }

  countEl.textContent = `${visible} / ${markers.size} buses`;
}

function fitAll() {
  const latLngs = [...markers.values()]
    .filter((m) => map.hasLayer(m))
    .map((m) => m.getLatLng());
  if (latLngs.length === 0) return;
  if (latLngs.length === 1) map.setView(latLngs[0], 14);
  else map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
}

async function refresh() {
  if (!authToken) {
    try { await fetchToken(); } catch { return; }
  }

  const listRes = await fetch('/api/fleet/list');
  if (!listRes.ok) return;
  const data = await listRes.json();
  allFleet = data.vehicles;

  if (allFleet.length === 0) {
    statusEl.textContent = 'No buses configured in fleet.json';
    return;
  }

  const results = await Promise.allSettled(
    allFleet.map((v) => fetchVehicleData(v.vehicleNo))
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
    vehicleCache.set(raw.vehicleNo, raw);

    const label = allFleet[i].label || '';
    const latLng = [lat, lon];
    const status = vehicleStatus(raw);
    const displayLabel = label || formatVehicleNo(raw.vehicleNo);

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
      vehicleCache.delete(vehicleNo);
    }
  }

  updateUI();

  const time = new Date().toLocaleTimeString();
  statusEl.textContent = `Updated ${time}`;
}

function popupHtml(v, label) {
  return (
    `<b>${label || formatVehicleNo(v.vehicleNo)}</b><br>` +
    `No: ${v.vehicleNo}<br>` +
    `Route: ${v.routeName || 'N/A'}<br>` +
    `Depot: ${v.depotName || 'N/A'}<br>` +
    `Speed: ${v.speed || 0} km/h<br>` +
    `Location: ${v.location || `${v.latitude}, ${v.longitude}`}<br>` +
    `Updated: ${v.receivedDate || 'N/A'}`
  );
}

searchInput.addEventListener('input', updateUI);
fitBtn.addEventListener('click', fitAll);

refresh();
setInterval(refresh, 30000);
