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
const statusEl = document.getElementById('status');

function popupHtml(v) {
  const where = v.landmarkName
    ? v.landmarkName + ' (~' + v.landmarkDistance + 'm)'
    : v.placeAddress || v.placeName || v.location || 'Unknown location';
  return '<div style="min-width:180px;font-size:13px;line-height:1.6">' +
    '<div style="font-weight:700;font-size:14px;margin-bottom:4px">Bus ' + (v.busNo || 'N/A') + '</div>' +
    '<div style="color:#64748b">' + v.vehicleNo + '</div>' +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0">' +
    '<div><strong>Route:</strong> ' + (v.routeName || 'N/A') + '</div>' +
    '<div><strong>Speed:</strong> ' + v.speed + ' km/h</div>' +
    '<div style="color:#64748b;font-size:12px;margin-top:4px">' + where + '</div>' +
    '<div style="color:#94a3b8;font-size:11px;margin-top:4px">' + (v.receivedDate || '') + '</div>' +
    '</div>';
}

async function refresh() {
  try {
    const res = await fetch('/api/bhujmundra');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const seen = new Set();
    for (const v of data.vehicles) {
      seen.add(v.vehicleNo);
      const latLng = [v.latitude, v.longitude];
      if (markers.has(v.vehicleNo)) {
        const marker = markers.get(v.vehicleNo);
        marker.setLatLng(latLng);
        marker.setPopupContent(popupHtml(v));
      } else {
        const marker = L.marker(latLng, { icon: busIcon })
          .addTo(map)
          .bindPopup(popupHtml(v))
          .bindTooltip('Bus ' + (v.busNo || v.vehicleNo), {
            permanent: true, direction: 'top',
            className: 'bus-label', offset: [0, -10],
          });
        markers.set(v.vehicleNo, marker);
      }
    }
    for (const [vehicleNo, marker] of markers) {
      if (!seen.has(vehicleNo)) { map.removeLayer(marker); markers.delete(vehicleNo); }
    }
    statusEl.textContent = data.vehicles.length + ' active bus' + (data.vehicles.length !== 1 ? 'es' : '') + ' on Bhuj-Mundra';
  } catch (err) {
    statusEl.textContent = 'Failed to load vehicle data';
  }
}

refresh();
setInterval(refresh, 30000);
