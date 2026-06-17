let authHeader = '';

async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (authHeader) headers.Authorization = authHeader;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && !authHeader) {
    const creds = prompt('Enter admin credentials (user:pass):');
    if (!creds) throw new Error('Authentication required');
    authHeader = 'Basic ' + btoa(creds);
    headers.Authorization = authHeader;
    const retry = await fetch(path, { ...options, headers });
    return retry;
  }
  return res;
}

const vehicleNoInput = document.getElementById('vehicleNo');
const addBtn = document.getElementById('addBtn');
const resultEl = document.getElementById('result');
const fleetListEl = document.getElementById('fleetList');
const busCountEl = document.getElementById('busCount');

function showToast(text, type) {
  resultEl.textContent = text;
  resultEl.className = 'toast ' + type;
  setTimeout(() => { resultEl.className = 'toast'; }, 4000);
}

async function addBus() {
  const vehicleNo = vehicleNoInput.value.trim().toUpperCase();
  if (!vehicleNo) { showToast('Enter a bus number', 'error'); return; }
  addBtn.disabled = true;
  showToast('Adding...', 'success');
  try {
    const res = await api('/api/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleNo }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Add failed', 'error');
      addBtn.disabled = false;
      return;
    }
    showToast('Added ' + vehicleNo, 'success');
    vehicleNoInput.value = '';
    renderFleet(data.vehicles);
  } catch (err) {
    showToast(err.message, 'error');
  }
  addBtn.disabled = false;
}

async function removeBus(index) {
  try {
    const res = await api('/api/fleet/' + index, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Remove failed', 'error'); return; }
    showToast('Bus removed', 'success');
    renderFleet(data.vehicles);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderFleet(vehicles) {
  if (vehicles.length === 0) {
    fleetListEl.innerHTML = '<div class="empty-state"><p>No buses configured. Add one above.</p></div>';
  } else {
    fleetListEl.innerHTML = '<div class="bus-list">' + vehicles.map((v, i) =>
      '<div class="bus-item">' +
        '<div class="info">' +
          '<span class="number">' + v.vehicleNo + '</span>' +
          (v.label ? '<span class="label-tag">' + v.label + '</span>' : '') +
        '</div>' +
        '<button onclick="removeBus(' + i + ')">Remove</button>' +
      '</div>'
    ).join('') + '</div>';
  }
  busCountEl.textContent = vehicles.length + ' bus' + (vehicles.length !== 1 ? 'es' : '');
}

async function loadFleet() {
  try {
    const res = await fetch('/api/fleet/list');
    if (!res.ok) return;
    const data = await res.json();
    renderFleet(data.vehicles);
  } catch {}
}

vehicleNoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBus(); });
loadFleet();
