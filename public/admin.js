const map = L.map('map').setView([23.0, 69.65], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const latInput = document.getElementById('lat');
const lonInput = document.getElementById('lon');
const nameInput = document.getElementById('name');
const radiusInput = document.getElementById('radius');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

let pickMarker = null;
const landmarkMarkers = [];

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#c00' : '#555';
}

window.addEventListener('error', (e) => {
  setStatus(`Script error: ${e.message}`, true);
});

map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  latInput.value = lat.toFixed(7);
  lonInput.value = lng.toFixed(7);

  if (pickMarker) {
    pickMarker.setLatLng(e.latlng);
  } else {
    pickMarker = L.marker(e.latlng, { opacity: 0.6 }).addTo(map);
  }

  setStatus(`Picked: ${latInput.value}, ${lonInput.value} - enter a name and click Save.`);
});

map.whenReady(() => {
  if (!statusEl.textContent) setStatus('Map ready. Click anywhere to pick a location.');
});

let readOnly = false;

async function loadLandmarks() {
  for (const marker of landmarkMarkers) map.removeLayer(marker);
  landmarkMarkers.length = 0;

  const res = await fetch('/api/landmarks');
  if (!res.ok) {
    setStatus(`Failed to load landmarks (HTTP ${res.status}). Are you logged in?`, true);
    return;
  }
  const data = await res.json();

  data.landmarks.forEach((landmark, index) => {
    if (landmark.latitude == null || landmark.longitude == null) return;

    const marker = L.marker([landmark.latitude, landmark.longitude]).addTo(map);
    const circle = L.circle([landmark.latitude, landmark.longitude], {
      radius: landmark.radiusMeters || 500,
      color: '#1a73e8',
      weight: 1,
      fillOpacity: 0.05,
    }).addTo(map);

    const container = document.createElement('div');
    container.className = 'landmark-popup';
    container.innerHTML = `<b>${landmark.name}</b><br>Radius: ${landmark.radiusMeters || 500}m<br>`;

    if (!readOnly) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => deleteLandmark(index);
      container.appendChild(deleteBtn);
    }

    marker.bindPopup(container);
    landmarkMarkers.push(marker, circle);
  });

  setStatus(`Loaded ${data.landmarks.length} landmark(s). Click the map to add another.`);
}

async function deleteLandmark(index) {
  const res = await fetch(`/api/landmarks/${index}`, { method: 'DELETE' });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setStatus(data.editUrl
      ? `Edit the JSON file directly on GitHub to delete landmarks: ${data.editUrl}`
      : (data.error || `Failed to delete (HTTP ${res.status})`), true);
    return;
  }

  setStatus('Landmark deleted.');
  await loadLandmarks();
}

saveBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  const radius = radiusInput.value ? parseFloat(radiusInput.value) : undefined;

  if (!name) return setStatus('Enter a name for the landmark.', true);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return setStatus('Click the map to pick a location.', true);

  const res = await fetch('/api/landmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, latitude: lat, longitude: lon, radiusMeters: radius }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setStatus(data.editUrl
      ? `Edit the JSON file directly on GitHub to add landmarks: ${data.editUrl}`
      : (data.error || `Failed to save (HTTP ${res.status})`), true);
    return;
  }

  setStatus(`Saved "${name}".`);
  nameInput.value = '';
  radiusInput.value = '';
  if (pickMarker) {
    map.removeLayer(pickMarker);
    pickMarker = null;
  }
  latInput.value = '';
  lonInput.value = '';
  await loadLandmarks();
});

loadLandmarks();

const fleetVehicleNoInput = document.getElementById('fleetVehicleNo');
const fleetLabelInput = document.getElementById('fleetLabel');
const fleetAddBtn = document.getElementById('fleetAddBtn');
const fleetListEl = document.getElementById('fleetList');
const fleetStatusEl = document.getElementById('fleetStatus');

function setFleetStatus(text, isError) {
  fleetStatusEl.textContent = text;
  fleetStatusEl.style.color = isError ? '#c00' : '#555';
}

async function loadFleet() {
  const res = await fetch('/api/fleet');
  if (!res.ok) {
    setFleetStatus(`Failed to load fleet (HTTP ${res.status}).`, true);
    return;
  }
  const data = await res.json();

  fleetListEl.innerHTML = '';
  data.vehicles.forEach((v, index) => {
    const row = document.createElement('div');
    const text = document.createElement('span');
    text.textContent = v.label ? `${v.vehicleNo} (${v.label})` : v.vehicleNo;

    if (!readOnly) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Remove';
      deleteBtn.onclick = () => deleteFleetVehicle(index);
      row.appendChild(text);
      row.appendChild(deleteBtn);
    } else {
      row.appendChild(text);
    }

    fleetListEl.appendChild(row);
  });

  setFleetStatus(`${data.vehicles.length} bus(es) in fleet.`);
}

async function deleteFleetVehicle(index) {
  const res = await fetch(`/api/fleet/${index}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setFleetStatus(data.editUrl
      ? `Edit the JSON file on GitHub to remove buses: ${data.editUrl}`
      : (data.error || `Failed to remove (HTTP ${res.status})`), true);
    return;
  }
  await loadFleet();
}

fleetAddBtn.addEventListener('click', async () => {
  const vehicleNo = fleetVehicleNoInput.value.trim();
  const label = fleetLabelInput.value.trim();

  if (!vehicleNo) return setFleetStatus('Enter a vehicle number.', true);

  const res = await fetch('/api/fleet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleNo, label }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setFleetStatus(data.editUrl
      ? `Edit the JSON file on GitHub to add buses: ${data.editUrl}`
      : (data.error || `Failed to add (HTTP ${res.status})`), true);
    return;
  }

  fleetVehicleNoInput.value = '';
  fleetLabelInput.value = '';
  await loadFleet();
});

async function checkWritable() {
  const res = await fetch('/api/fleet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (res.status === 503) {
    readOnly = true;
    const data = await res.json();
    const banner = document.getElementById('readonlyBanner');
    if (banner && data.editUrl) {
      banner.innerHTML = `&#128274; Read-only mode. Edit <a href="${data.editUrl}" target="_blank">JSON files on GitHub</a> to make changes.`;
      banner.style.display = 'block';
    }
    saveBtn.disabled = true;
    saveBtn.title = 'Read-only mode — edit on GitHub instead';
    fleetAddBtn.disabled = true;
    fleetAddBtn.title = 'Read-only mode — edit on GitHub instead';
  }
}

checkWritable();
loadFleet();
