/* -----------------------------
  App.js - Bus Tracker Pro
  - Uses Firebase Realtime Database (compat)
  - Uses Leaflet for maps
----------------------------- */

/* ====== CONFIGURE FIREBASE ======
  1) Create a Firebase project at console.firebase.google.com
  2) Add a web app and copy firebaseConfig into the object below
  3) Enable Realtime Database and set rules (development rules supplied below)
================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDeW9xeNEKBnXzHNoaAdkLuxaXYocSEq18",
  authDomain: "my-bus-tracker-c734b.firebaseapp.com",
  databaseURL: "https://my-bus-tracker-c734b-default-rtdb.firebaseio.com",
  projectId: "my-bus-tracker-c734b",
  storageBucket: "my-bus-tracker-c734b.firebasestorage.app",
  messagingSenderId: "255818671180",
  appId: "1:255818671180:web:2b8fb2d4a88c5a109dc0e9",
  measurementId: "G-VPE06MYXSG"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* --------------------------
  Map initialization (Leaflet)
--------------------------- */
const map = L.map('map', { zoomControl: true }).setView([12.9716, 77.5946], 12);

// tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// marker icon
const busIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/* --------------------------
  App state
--------------------------- */
let markers = {}; // busId -> Leaflet marker
let userMarker = null;

/* --------------------------
  UI refs
--------------------------- */
const busesListEl = document.getElementById('busesList');
const adminBody = document.getElementById('adminBody');
const routeSelect = document.getElementById('routeNumber');
const searchBtn = document.getElementById('searchBtn');

const driverNameEl = document.getElementById('driverName');
const busIdEl = document.getElementById('busId');
const driverRouteEl = document.getElementById('driverRoute');
const getLocBtn = document.getElementById('getLocBtn');
const startShareBtn = document.getElementById('startShare');
const stopShareBtn = document.getElementById('stopShare');
const currentLatEl = document.getElementById('currentLat');
const currentLngEl = document.getElementById('currentLng');
const locationStatusEl = document.getElementById('locationStatus');
const statusCoordsEl = document.getElementById('statusCoords');
const lastUpdateEl = document.getElementById('lastUpdate');
const driverAlert = document.getElementById('driverAlert');

const registerBusBtn = document.getElementById('registerBusBtn');
const adminBusId = document.getElementById('adminBusId');
const adminRoute = document.getElementById('adminRoute');
const adminAlert = document.getElementById('adminAlert');

/* --------------------------
  Tabs
--------------------------- */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/* --------------------------
  Listen to buses in realtime
  structure in DB: /buses/{busId} = { busId, driver, lat, lng, route, status, lastUpdate }
  driver history saved at /drivers/{busId}/history/{timestamp}
--------------------------- */

const busesRef = db.ref('buses');

busesRef.on('value', snapshot => {
  const data = snapshot.val() || {};
  updateMapAndList(data);
  updateAdminTable(data);
});

/* --------------------------
  Update map/list functions
--------------------------- */
function updateMapAndList(busesData = {}) {
  // Update markers
  const bounds = [];
  const busIds = Object.keys(busesData);

  // remove markers that no longer exist
  for (const id in markers) {
    if (!busIds.includes(id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  }

  busesListEl.innerHTML = '';

  busIds.forEach(id => {
    const bus = busesData[id];
    if (!bus || !bus.lat || !bus.lng) return;

    // update/add marker
    if (!markers[id]) {
      const m = L.marker([bus.lat, bus.lng], { icon: busIcon }).addTo(map);
      m.bindPopup(`<strong>${bus.busId}</strong><br>${bus.driver || 'Unknown'}<br>Route: ${bus.route || '-'}`);
      markers[id] = m;
    } else {
      // smooth update: we simply set new position
      markers[id].setLatLng([bus.lat, bus.lng]);
      markers[id].getPopup().setContent(`<strong>${bus.busId}</strong><br>${bus.driver || 'Unknown'}<br>Route: ${bus.route || '-'}`);
    }

    bounds.push([bus.lat, bus.lng]);

    // Add bus to passenger list
    const card = document.createElement('div');
    card.className = 'bus-card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${bus.busId}</strong><div style="font-size:0.9rem;color:#666">${bus.driver || 'Unassigned'}</div></div>
        <div style="text-align:right">
          <div>Route: ${bus.route || '-'}</div>
          <div style="font-size:0.85rem;color:#888">${bus.status || 'offline'}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:0.9rem;color:#444">${bus.lat.toFixed(5)}, ${bus.lng.toFixed(5)}</div>
      <div style="margin-top:8px;text-align:right">
        <button class="btn" onclick="focusBus('${id}')">Track</button>
      </div>
    `;
    busesListEl.appendChild(card);
  });

  // fit map bounds if there are markers
  if (bounds.length) {
    try {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds.pad(0.3));
    } catch (e) {
      // ignore
    }
  }
}

/* focus on a bus marker */
function focusBus(busId) {
  const m = markers[busId];
  if (m) {
    map.setView(m.getLatLng(), 16);
    m.openPopup();
  }
}

/* --------------------------
  Passenger search - filter by route
--------------------------- */
searchBtn.addEventListener('click', () => {
  const route = routeSelect.value;
  if (!route) {
    // show all: simply trigger value event (already live)
    busesRef.once('value').then(snap => updateMapAndList(snap.val() || {}));
    return;
  }
  busesRef.orderByChild('route').equalTo(route).once('value', snap => {
    updateMapAndList(snap.val() || {});
  });
});

/* --------------------------
  Admin table
--------------------------- */
function updateAdminTable(busesData = {}) {
  adminBody.innerHTML = '';
  const keys = Object.keys(busesData);
  keys.forEach(id => {
    const b = busesData[id];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${b.busId}</td>
      <td>${b.route || '-'}</td>
      <td>${b.driver || '-'}</td>
      <td>${(b.lat && b.lng) ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : 'N/A'}</td>
      <td>${b.status || 'offline'}</td>
      <td>${b.lastUpdate ? new Date(b.lastUpdate).toLocaleTimeString() : '-'}</td>
    `;
    adminBody.appendChild(row);
  });
}

/* --------------------------
  Driver location sharing
--------------------------- */
let watchId = null;
let isSharing = false;

getLocBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    currentLatEl.value = latitude.toFixed(6);
    currentLngEl.value = longitude.toFixed(6);
    locationStatusEl.style.display = 'block';
    statusCoordsEl.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    lastUpdateEl.textContent = new Date().toLocaleTimeString();
  }, err => alert(err.message), { enableHighAccuracy: true });
});

startShareBtn.addEventListener('click', () => {
  const driverName = driverNameEl.value.trim();
  const busId = busIdEl.value.trim();
  const route = driverRouteEl.value;

  if (!driverName || !busId || !route) return alert('Please fill driver name, bus id and route');

  if (!navigator.geolocation) return alert('Geolocation not supported');

  if (isSharing) return alert('Already sharing');

  // start watchPosition and write to Firebase
  watchId = navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const timestamp = Date.now();

    // update UI
    currentLatEl.value = lat.toFixed(6);
    currentLngEl.value = lng.toFixed(6);
    locationStatusEl.style.display = 'block';
    statusCoordsEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    lastUpdateEl.textContent = new Date(timestamp).toLocaleTimeString();

    // write to /buses/{busId}
    const busObj = {
      busId,
      driver: driverName,
      lat,
      lng,
      route,
      status: 'online',
      lastUpdate: timestamp
    };
    db.ref(`buses/${busId}`).set(busObj);

    // append to driver history: /drivers/{busId}/history/{pushId}
    const histRef = db.ref(`drivers/${busId}/history`);
    histRef.push({
      lat, lng, timestamp
    });

    driverAlert.style.display = 'block';
    driverAlert.textContent = 'Sharing live location...';
  }, err => {
    alert('Error reading position: ' + err.message);
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });

  isSharing = true;
});

stopShareBtn.addEventListener('click', () => {
  if (!isSharing) return alert('Not currently sharing');
  // stop watching
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  // set status offline in DB (if busId provided)
  const id = busIdEl.value.trim();
  if (id) {
    db.ref(`buses/${id}`).update({ status: 'offline', lastUpdate: Date.now() });
  }
  isSharing = false;
  driverAlert.style.display = 'block';
  driverAlert.textContent = 'Stopped sharing';
});

/* --------------------------
  Admin register bus (manual)
--------------------------- */
registerBusBtn.addEventListener('click', () => {
  const id = adminBusId.value.trim();
  const route = adminRoute.value.trim();
  if (!id || !route) return alert('Enter bus id and route');

  const busObj = {
    busId: id,
    driver: 'Unassigned',
    lat: 12.9716,
    lng: 77.5946,
    route,
    status: 'offline',
    lastUpdate: Date.now()
  };
  db.ref(`buses/${id}`).set(busObj).then(() => {
    adminAlert.style.display = 'block';
    adminAlert.textContent = `Registered ${id}`;
    adminBusId.value = '';
    adminRoute.value = '';
  }).catch(err => alert(err.message));
});

/* --------------------------
  OPTIONAL: initialize with sample buses if DB empty (only for first-time development)
--------------------------- */
busesRef.once('value').then(snap => {
  if (!snap.exists()) {
    const sample = {
      'BUS001': { busId: 'BUS001', driver: 'Raj', lat: 12.9716, lng: 77.5946, route: '101', status:'online', lastUpdate: Date.now() },
      'BUS002': { busId: 'BUS002', driver: 'Amit', lat: 12.9652, lng: 77.5935, route: '102', status:'online', lastUpdate: Date.now() }
    };
    busesRef.set(sample);
  }
});
