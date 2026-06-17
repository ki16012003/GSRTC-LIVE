// Roughly centers the Bhuj-Mundra route (Kutch district, Gujarat).
const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const markers = new Map(); // vehicleNo -> marker
const statusEl = document.getElementById('status');

function popupHtml(v) {
  const where = v.landmarkName
    ? `${v.landmarkName} (~${v.landmarkDistance}m)`
    : v.placeAddress || v.placeName || v.location || 'Unknown location';
  return (
    `<b>Bus ${v.busNo || 'N/A'}</b> (${v.vehicleNo})<br>` +
    `${where}<br>` +
    `Speed: ${v.speed} km/h<br>` +
    `Route: ${v.routeName || 'N/A'}<br>` +
    `Updated: ${v.receivedDate || 'N/A'}`
  );
}

async function refresh() {
  try {
    const res = await fetch('/api/bhujmundra');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        const marker = L.marker(latLng)
          .addTo(map)
          .bindPopup(popupHtml(v))
          .bindTooltip(`Bus ${v.busNo || v.vehicleNo}`, {
            permanent: true,
            direction: 'top',
            className: 'bus-label',
            offset: [0, -10],
          });
        markers.set(v.vehicleNo, marker);
      }
    }

    // Remove markers for buses that are no longer active on the route.
    for (const [vehicleNo, marker] of markers) {
      if (!seen.has(vehicleNo)) {
        map.removeLayer(marker);
        markers.delete(vehicleNo);
      }
    }

    const time = new Date(data.updatedAt).toLocaleTimeString();
    statusEl.textContent = `${data.vehicles.length} active bus(es) on Bhuj-Mundra — updated ${time}`;
  } catch (err) {
    statusEl.textContent = 'Failed to load vehicle data';
  }
}

refresh();
setInterval(refresh, 30000);
