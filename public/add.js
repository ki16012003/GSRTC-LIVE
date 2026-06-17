const resultEl = document.getElementById('result');
const listEl = document.getElementById('list');
const fleetListEl = document.getElementById('fleetList');
const busCountEl = document.getElementById('busCount');
const vehicleNoInput = document.getElementById('vehicleNo');
const addBtn = document.getElementById('addBtn');

function show(text, type) {
  resultEl.textContent = text;
  resultEl.className = type;
}

async function addBus() {
  const vehicleNo = vehicleNoInput.value.trim().toUpperCase();
  if (!vehicleNo) { show('Enter a bus number', 'error'); return; }

  addBtn.disabled = true;
  show('Adding...', 'success');

  try {
    const res = await fetch('/api/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleNo }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.editUrl
        ? `Edit the fleet.json on GitHub: <a href="${data.editUrl}" target="_blank">${data.editUrl}</a>`
        : data.error || `HTTP ${res.status}`;
      resultEl.innerHTML = msg;
      resultEl.className = 'error';
      addBtn.disabled = false;
      return;
    }

    show(`Added ${vehicleNo} to fleet`, 'success');
    vehicleNoInput.value = '';
    renderFleet(data.vehicles);
  } catch (err) {
    show(`Error: ${err.message}`, 'error');
  }

  addBtn.disabled = false;
}

async function removeBus(index) {
  try {
    const res = await fetch(`/api/fleet/${index}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      show(data.error || 'Failed to remove', 'error');
      return;
    }
    show('Bus removed', 'success');
    renderFleet(data.vehicles);
  } catch (err) {
    show(`Error: ${err.message}`, 'error');
  }
}

function renderFleet(vehicles) {
  listEl.className = 'visible';
  fleetListEl.innerHTML = '';
  vehicles.forEach((v, i) => {
    const div = document.createElement('div');
    div.className = 'bus-item';
    div.innerHTML = `<span>${v.vehicleNo}${v.label ? ` (${v.label})` : ''}</span>
      <button onclick="removeBus(${i})">Remove</button>`;
    fleetListEl.appendChild(div);
  });
  busCountEl.textContent = `${vehicles.length} bus(es)`;
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
