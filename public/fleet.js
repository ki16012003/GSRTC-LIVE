const GSRTC_API = 'https://live.gsrtc.org/api/vehicle/tooltip';

const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

const busIcon = L.divIcon({
  className: '',
  html: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="14" rx="3" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><rect x="4" y="9" width="16" height="6" rx="1" fill="#1d4ed8"/><circle cx="7" cy="18" r="2" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><circle cx="17" cy="18" r="2" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><rect x="9" y="6" width="6" height="2" rx="1" fill="#60a5fa"/></svg>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

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
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
    body: JSON.stringify({ vehicleNo }),
  });
  if (!res.ok) return null;
  return res.json();
}

function popupHtml(v, label) {
  return '<div style="min-width:180px;font-size:13px;line-height:1.6">' +
    '<div style="font-weight:700;font-size:14px;margin-bottom:4px">' + (label || formatVehicleNo(v.vehicleNo)) + '</div>' +
    '<div style="color:#64748b">' + v.vehicleNo + '</div>' +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0">' +
    '<div><strong>Route:</strong> ' + (v.routeName || 'N/A') + '</div>' +
    '<div><strong>Depot:</strong> ' + (v.depotName || 'N/A') + '</div>' +
    '<div><strong>Speed:</strong> ' + (v.speed || 0) + ' km/h</div>' +
    '<div style="color:#64748b;font-size:12px;margin-top:4px">' + (v.location || v.latitude + ', ' + v.longitude) + '</div>' +
    '<div style="color:#94a3b8;font-size:11px;margin-top:4px">' + (v.receivedDate || '') + '</div>' +
    '</div>';
}

function updateUI() {
  const q = searchInput.value.trim().toLowerCase();
  let visible = 0;
  for (const [vehicleNo, marker] of markers) {
    const v = vehicleCache.get(vehicleNo);
    if (!v) continue;
    const haystack = (v.vehicleNo + ' ' + (v.busNo || '') + ' ' + (v.routeName || '') + ' ' + (v.depotName || '') + ' ' + (v.location || '')).toLowerCase();
    const match = !q || haystack.includes(q);
    if (match && !map.hasLayer(marker)) { marker.addTo(map); visible++; }
    else if (match) { visible++; }
    else if (map.hasLayer(marker)) { map.removeLayer(marker); }
  }
  countEl.textContent = visible + ' / ' + markers.size + ' buses';
}

function fitAll() {
  const latLngs = [...markers.values()].filter(m => map.hasLayer(m)).map(m => m.getLatLng());
  if (latLngs.length === 0) return;
  if (latLngs.length === 1) map.setView(latLngs[0], 14);
  else map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
}

async function refresh() {
  if (!authToken) { try { await fetchToken(); } catch { return; } }
  const listRes = await fetch('/api/fleet/list');
  if (!listRes.ok) return;
  const data = await listRes.json();
  allFleet = data.vehicles;
  if (allFleet.length === 0) { statusEl.textContent = 'No buses configured in fleet.json'; return; }
  const results = await Promise.allSettled(allFleet.map(v => fetchVehicleData(v.vehicleNo)));
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
      const marker = L.marker(latLng, { icon: busIcon })
        .addTo(map)
        .bindPopup(popupHtml(raw, label))
        .bindTooltip(displayLabel, {
          permanent: true, direction: 'top',
          className: 'bus-label ' + status, offset: [0, -10],
        });
      markers.set(raw.vehicleNo, marker);
    }
  }
  for (const [vehicleNo, marker] of markers) {
    if (!seen.has(vehicleNo)) { map.removeLayer(marker); markers.delete(vehicleNo); vehicleCache.delete(vehicleNo); }
  }
  updateUI();
  statusEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

searchInput.addEventListener('input', updateUI);
fitBtn.addEventListener('click', fitAll);
refresh();
setInterval(refresh, 30000);
