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

function showResult(text, type) {
  resultEl.textContent = text;
  resultEl.className = type;
}

async function addBus() {
  const vehicleNo = vehicleNoInput.value.trim().toUpperCase();
  if (!vehicleNo) { showResult('Enter a bus number', 'error'); return; }

  addBtn.disabled = true;
  showResult('Adding...', 'success');

  try {
    const res = await api('/api/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleNo }),
    });

    const data = await res.json();

    if (!res.ok) {
      showResult(data.error || `Add failed (HTTP ${res.status})`, 'error');
      addBtn.disabled = false;
      return;
    }

    showResult(`Added ${vehicleNo}`, 'success');
    vehicleNoInput.value = '';
    renderFleet(data.vehicles);
  } catch (err) {
    showResult(err.message, 'error');
  }

  addBtn.disabled = false;
}

async function removeBus(index) {
  try {
    const res = await api(`/api/fleet/${index}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showResult(data.error || 'Remove failed', 'error'); return; }
    showResult('Bus removed', 'success');
    renderFleet(data.vehicles);
  } catch (err) {
    showResult(err.message, 'error');
  }
}

function renderFleet(vehicles) {
  fleetListEl.innerHTML = vehicles.length
    ? vehicles.map((v, i) =>
        `<div class="bus-item">
          <span>${v.vehicleNo}${v.label ? ` (${v.label})` : ''}</span>
          <button onclick="removeBus(${i})">Remove</button>
        </div>`
      ).join('')
    : '<div style="color:#888;font-size:13px;padding:8px 0">No buses configured. Add one above.</div>';

  busCountEl.textContent = `${vehicles.length} bus(es) in fleet`;
}

async function loadFleet() {
  try {
    const res = await fetch('/api/fleet/list');
    if (!res.ok) return;
    const data = await res.json();
    renderFleet(data.vehicles);
  } catch { }
}

vehicleNoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBus();
});

loadFleet();
