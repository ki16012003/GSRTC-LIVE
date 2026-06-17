const GSRTC_API = 'https://live.gsrtc.org/api/vehicle/tooltip';

const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

const busIcon = L.divIcon({
  className: '',
  html: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="14" rx="3" fill="currentColor" stroke="#fff" stroke-width="1.5"/><rect x="4" y="9" width="16" height="6" rx="1" fill="rgba(0,0,0,0.2)"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="17" cy="18" r="2" fill="currentColor" stroke="#fff" stroke-width="1.5"/><rect x="9" y="6" width="6" height="2" rx="1" fill="rgba(255,255,255,0.4)"/></svg>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const markers = new Map();
const vehicleCache = new Map();
const statusEl = document.getElementById('status');
const busInput = document.getElementById('busInput');
const routeFilter = document.getElementById('routeFilter');
const countEl = document.getElementById('count');
const goBtn = document.getElementById('goBtn');
const fitBtn = document.getElementById('fitBtn');

let authToken = null;

function vehicleStatus(v) {
  if (String(v.nocomm) === '1') return 'nosignal';
  if (Number(v.speed) > 0 || String(v.running) === '1') return 'running';
  return 'idle';
}

function colorForStatus(s) {
  return s === 'running' ? '#16a34a' : s === 'idle' ? '#d97706' : '#64748b';
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
  const statusText = vehicleStatus(v);
  const statusLabel = statusText === 'running' ? 'Running' : statusText === 'idle' ? 'Stopped' : 'No Signal';
  const statusColor = colorForStatus(statusText);
  return '<div style="min-width:200px;font-size:13px;line-height:1.6">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
      '<span style="font-weight:700;font-size:14px">' + (label || formatVehicleNo(v.vehicleNo)) + '</span>' +
      '<span style="font-size:11px;font-weight:600;padding:1px 8px;border-radius:99px;background:' + statusColor + '20;color:' + statusColor + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div style="color:#64748b">' + v.vehicleNo + '</div>' +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0">' +
    '<div><strong>Route:</strong> ' + (v.routeName || 'N/A') + '</div>' +
    '<div><strong>Speed:</strong> ' + (v.speed || 0) + ' km/h</div>' +
    '<div><strong>Depot:</strong> ' + (v.depotName || 'N/A') + '</div>' +
    '<div style="color:#64748b;font-size:12px;margin-top:4px">' + (v.location || v.latitude + ', ' + v.longitude) + '</div>' +
    '<div style="color:#94a3b8;font-size:11px;margin-top:4px">' + (v.receivedDate || '') + '</div>' +
    '</div>';
}

function updateUI() {
  const routeQ = routeFilter.value.trim().toLowerCase();
  const searchQ = '';
  let visible = 0;
  for (const [vehicleNo, marker] of markers) {
    const v = vehicleCache.get(vehicleNo);
    if (!v) continue;
    const routeMatch = !routeQ || (v.routeName || '').toLowerCase().includes(routeQ);
    const show = routeMatch;
    if (show && !map.hasLayer(marker)) { marker.addTo(map); visible++; }
    else if (show) { visible++; }
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

function clearMap() {
  for (const [vno, marker] of markers) { map.removeLayer(marker); }
  markers.clear();
  vehicleCache.clear();
}

async function search(vehicleNos) {
  if (!authToken) { try { await fetchToken(); } catch { return; } }
  if (!vehicleNos || vehicleNos.length === 0) return;
  statusEl.textContent = 'Fetching ' + vehicleNos.length + ' bus(es)...';
  const results = await Promise.allSettled(vehicleNos.map(v => fetchVehicleData(v)));
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
    const status = vehicleStatus(raw);
    const displayLabel = formatVehicleNo(raw.vehicleNo);
    const color = colorForStatus(status);
    if (markers.has(raw.vehicleNo)) {
      const marker = markers.get(raw.vehicleNo);
      marker.setLatLng([lat, lon]);
      marker.setPopupContent(popupHtml(raw, ''));
      marker.setTooltipContent(displayLabel);
      marker.getElement().querySelector('svg')?.style?.setProperty('color', color);
    } else {
      const customIcon = L.divIcon({
        className: '',
        html: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="color:' + color + '"><rect x="2" y="4" width="20" height="14" rx="3" fill="currentColor" stroke="#fff" stroke-width="1.5"/><rect x="4" y="9" width="16" height="6" rx="1" fill="rgba(0,0,0,0.2)"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="17" cy="18" r="2" fill="currentColor" stroke="#fff" stroke-width="1.5"/><rect x="9" y="6" width="6" height="2" rx="1" fill="rgba(255,255,255,0.4)"/></svg>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });
      const marker = L.marker([lat, lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml(raw, ''))
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
  const visible = [...markers.values()].filter(m => map.hasLayer(m)).length;
  statusEl.textContent = visible + ' bus(es) on map — updated ' + new Date().toLocaleTimeString();
}

async function doSearch() {
  const raw = busInput.value.trim();
  let vehicleNos;
  if (raw) {
    vehicleNos = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  } else {
    try {
      const res = await fetch('/api/fleet/list');
      if (res.ok) {
        const data = await res.json();
        vehicleNos = (data.vehicles || []).map(v => v.vehicleNo).filter(Boolean);
      }
    } catch {}
  }
  if (!vehicleNos || vehicleNos.length === 0) {
    statusEl.textContent = 'Enter bus numbers or configure them in Admin page';
    return;
  }
  clearMap();
  await search(vehicleNos);
}

routeFilter.addEventListener('input', updateUI);
fitBtn.addEventListener('click', fitAll);
goBtn.addEventListener('click', doSearch);
busInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
routeFilter.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

if (busInput.value.trim()) doSearch();
