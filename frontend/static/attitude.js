const state = {
  firstTimestamp: null,
  latestSample: {},
  latestTime: 0,
};

const dom = {
  statusBadge: document.getElementById('status-badge'),
  statusPort: document.getElementById('status-port'),
  statusBaud: document.getElementById('status-baud'),
  quatReadout: document.getElementById('quat-readout'),
  sampleClock: document.getElementById('sample-clock'),
  rollValue: document.getElementById('roll-value'),
  pitchValue: document.getElementById('pitch-value'),
  yawValue: document.getElementById('yaw-value'),
  fixValue: document.getElementById('fix-value'),
  latValue: document.getElementById('lat-value'),
  lonValue: document.getElementById('lon-value'),
  gyroValue: document.getElementById('gyro-value'),
  accelValue: document.getElementById('accel-value'),
};

function formatNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}

function formatDegrees(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(1)} deg`;
}

function setStatus(message) {
  const text = message || 'Connecting';
  const normalized = text.toLowerCase();
  let statusClass = 'connecting';
  if (normalized === 'streaming' || normalized.startsWith('demo')) {
    statusClass = normalized.startsWith('demo') ? 'demo' : 'streaming';
  } else if (normalized.includes('error') || normalized.includes('cannot')) {
    statusClass = 'error';
  } else if (normalized.includes('disconnect')) {
    statusClass = 'disconnected';
  }

  dom.statusBadge.className = `status ${statusClass}`;
  dom.statusBadge.textContent = text;
}

function normalizeQuaternion(qw, qx, qy, qz) {
  const norm = Math.hypot(qw, qx, qy, qz);
  if (norm <= 0.0) {
    return null;
  }

  return {
    w: qw / norm,
    x: qx / norm,
    y: qy / norm,
    z: qz / norm,
  };
}

function quaternionToDcm(qw, qx, qy, qz) {
  return [
    [
      (qw * qw) + (qx * qx) - (qy * qy) - (qz * qz),
      2.0 * ((qx * qy) - (qw * qz)),
      2.0 * ((qx * qz) + (qw * qy)),
    ],
    [
      2.0 * ((qx * qy) + (qw * qz)),
      (qw * qw) - (qx * qx) + (qy * qy) - (qz * qz),
      2.0 * ((qy * qz) - (qw * qx)),
    ],
    [
      2.0 * ((qx * qz) - (qw * qy)),
      2.0 * ((qy * qz) + (qw * qx)),
      (qw * qw) - (qx * qx) - (qy * qy) + (qz * qz),
    ],
  ];
}

function mat3Multiply(a, b) {
  const out = [
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
  ];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      for (let k = 0; k < 3; k += 1) {
        out[row][col] += a[row][k] * b[k][col];
      }
    }
  }

  return out;
}

function mat3Transpose(matrix) {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

const C_IMU_TO_BODY = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
];

const BODY_TO_THREE = [
  [1.0, 0.0, 0.0],
  [0.0, 0.0, -1.0],
  [0.0, 1.0, 0.0],
];

function quaternionToBodyPoseDegrees(qw, qx, qy, qz) {
  const cNavToImu = quaternionToDcm(qw, qx, qy, qz);
  const cImuToNav = mat3Transpose(cNavToImu);
  const cBodyToNav = mat3Multiply(cImuToNav, mat3Transpose(C_IMU_TO_BODY));

  const roll = Math.atan2(cBodyToNav[2][1], cBodyToNav[2][2]) * (180.0 / Math.PI);
  const pitch = Math.asin(Math.max(-1.0, Math.min(1.0, -cBodyToNav[2][0]))) * (180.0 / Math.PI);
  const headingWrapped = Math.atan2(cBodyToNav[1][0], cBodyToNav[0][0]) * (180.0 / Math.PI);
  const heading = headingWrapped >= 0.0 ? headingWrapped : headingWrapped + 360.0;

  return { roll, pitch, heading, dcmBodyToNav: cBodyToNav };
}

function setVehicleQuaternionFromDcm(cBodyToNav) {
  const cThree = mat3Multiply(mat3Multiply(BODY_TO_THREE, cBodyToNav), mat3Transpose(BODY_TO_THREE));
  const matrix = new THREE.Matrix4();
  matrix.set(
    cThree[0][0], cThree[0][1], cThree[0][2], 0.0,
    cThree[1][0], cThree[1][1], cThree[1][2], 0.0,
    cThree[2][0], cThree[2][1], cThree[2][2], 0.0,
    0.0, 0.0, 0.0, 1.0,
  );
  vehicle.quaternion.setFromRotationMatrix(matrix);
}

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a12);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);
renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', resize);
resize();

scene.add(new THREE.AmbientLight(0x3c4858, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
keyLight.position.set(8, 10, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x4dd8ff, 0.35);
rimLight.position.set(-8, 6, -5);
scene.add(rimLight);

const grid = new THREE.GridHelper(30, 30, 0x233247, 0x142031);
scene.add(grid);

function makeLine(from, to, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
}

scene.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), 0xff6e86));
scene.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 0), 0x4da0ff));
scene.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10), 0x35e0a1));

const vehicle = new THREE.Group();
scene.add(vehicle);

const bodyMat = new THREE.MeshPhongMaterial({ color: 0x66768d, flatShading: true });
const accentMat = new THREE.MeshPhongMaterial({ color: 0x4dd8ff, flatShading: true });
const darkMat = new THREE.MeshPhongMaterial({ color: 0x253142, flatShading: true });

const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 4.6, 10), bodyMat);
fuselage.rotation.z = Math.PI / 2;
vehicle.add(fuselage);

const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 10), accentMat);
nose.rotation.z = -Math.PI / 2;
nose.position.x = 2.75;
vehicle.add(nose);

const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
canopy.position.set(0.8, 0.28, 0);
canopy.scale.set(1.4, 0.8, 0.9);
vehicle.add(canopy);

const wingGeom = new THREE.BoxGeometry(1.8, 0.08, 5.4);
const wing = new THREE.Mesh(wingGeom, bodyMat);
wing.position.set(0.2, 0, 0);
vehicle.add(wing);

const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.08), darkMat);
tailFin.position.set(-1.9, 0.6, 0);
vehicle.add(tailFin);

const tailPlaneL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.2), darkMat);
tailPlaneL.position.set(-1.8, 0.0, -1.1);
vehicle.add(tailPlaneL);
const tailPlaneR = tailPlaneL.clone();
tailPlaneR.position.z = 1.1;
vehicle.add(tailPlaneR);

vehicle.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(3.6, 0, 0), 0xff6e86));
vehicle.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3.6), 0x35e0a1));
vehicle.add(makeLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -2.4, 0), 0x4da0ff));

const orbitTarget = new THREE.Vector3(0, 0, 0);
const panPlane = new THREE.Plane();
const panPlaneNormal = new THREE.Vector3();
const panStartPoint = new THREE.Vector3();
const panCurrentPoint = new THREE.Vector3();
const panDelta = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

camera.position.set(8.5, 4.5, 8.5);
camera.lookAt(orbitTarget);

let orbitAzimuth = 0.75;
let orbitElevation = 0.4;
let orbitDistance = 12.0;
let orbitDragging = false;
let panDragging = false;
let lastMouse = { x: 0, y: 0 };

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2.0 - 1.0;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2.0 - 1.0);
}

function projectPointerToPlane(event, plane, out) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(plane, out) !== null;
}

function updatePanPlane() {
  camera.getWorldDirection(panPlaneNormal);
  panPlane.setFromNormalAndCoplanarPoint(panPlaneNormal, orbitTarget);
}

renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 2) {
    updatePanPlane();
    if (projectPointerToPlane(event, panPlane, panStartPoint)) {
      panDragging = true;
    }
    return;
  }

  if (event.button === 0) {
    orbitDragging = true;
    lastMouse = { x: event.clientX, y: event.clientY };
  }
});

window.addEventListener('mouseup', () => {
  orbitDragging = false;
  panDragging = false;
});

window.addEventListener('mousemove', (event) => {
  if (panDragging) {
    if (projectPointerToPlane(event, panPlane, panCurrentPoint)) {
      panDelta.subVectors(panStartPoint, panCurrentPoint);
      orbitTarget.add(panDelta);
      panStartPoint.add(panDelta);
    }
    return;
  }

  if (!orbitDragging) {
    return;
  }

  orbitAzimuth -= (event.clientX - lastMouse.x) * 0.008;
  orbitElevation = Math.max(-0.15, Math.min(1.25, orbitElevation + (event.clientY - lastMouse.y) * 0.008));
  lastMouse = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('wheel', (event) => {
  orbitDistance = Math.max(5.0, Math.min(28.0, orbitDistance + event.deltaY * 0.01));
  event.preventDefault();
}, { passive: false });

function renderLoop() {
  requestAnimationFrame(renderLoop);
  camera.position.set(
    orbitTarget.x + (Math.cos(orbitAzimuth) * Math.cos(orbitElevation) * orbitDistance),
    orbitTarget.y + (Math.sin(orbitElevation) * orbitDistance),
    orbitTarget.z + (Math.sin(orbitAzimuth) * Math.cos(orbitElevation) * orbitDistance),
  );
  camera.lookAt(orbitTarget);
  renderer.render(scene, camera);
}
renderLoop();

function updateReadout(sample, timeValue) {
  if (!sample || !Number.isFinite(sample.qw) || !Number.isFinite(sample.qx) || !Number.isFinite(sample.qy) || !Number.isFinite(sample.qz)) {
    return;
  }

  const q = normalizeQuaternion(sample.qw, sample.qx, sample.qy, sample.qz);
  if (q == null) {
    return;
  }

  const pose = quaternionToBodyPoseDegrees(q.w, q.x, q.y, q.z);

  dom.quatReadout.textContent = `w ${formatNumber(q.w, 4)}  x ${formatNumber(q.x, 4)}  y ${formatNumber(q.y, 4)}  z ${formatNumber(q.z, 4)}`;
  dom.rollValue.textContent = formatDegrees(pose.roll);
  dom.pitchValue.textContent = formatDegrees(pose.pitch);
  dom.yawValue.textContent = formatDegrees(pose.heading);
  dom.sampleClock.textContent = `t = ${formatNumber(timeValue, 2)} s`;
  dom.fixValue.textContent = Number.isFinite(sample.fix) ? String(sample.fix) : '-';
  dom.latValue.textContent = formatNumber(sample.lat, 7);
  dom.lonValue.textContent = formatNumber(sample.lon, 7);
  dom.gyroValue.textContent = `(${formatNumber(sample.gx, 4)}, ${formatNumber(sample.gy, 4)}, ${formatNumber(sample.gz, 4)})`;
  dom.accelValue.textContent = `(${formatNumber(sample.ax, 4)}, ${formatNumber(sample.ay, 4)}, ${formatNumber(sample.az, 4)})`;

  setVehicleQuaternionFromDcm(pose.dcmBodyToNav);
}

function mergeSample(sample) {
  for (const [key, value] of Object.entries(sample || {})) {
    if (key === 'timestamp' || key === 't' || key === 'kind') {
      continue;
    }
    state.latestSample[key] = value;
  }
}

function handleSamples(samples) {
  if (!Array.isArray(samples) || !samples.length) {
    return;
  }

  if (state.firstTimestamp == null && Number.isFinite(samples[0].timestamp)) {
    state.firstTimestamp = samples[0].timestamp;
  }

  for (const sample of samples) {
    const hasTimestamp = Number.isFinite(sample.timestamp) && Number.isFinite(state.firstTimestamp);
    const timeValue = hasTimestamp
      ? sample.timestamp - state.firstTimestamp
      : Number.isFinite(sample.t)
        ? sample.t
        : state.latestTime;

    state.latestTime = Math.max(state.latestTime, timeValue);
    mergeSample(sample);
    updateReadout(state.latestSample, timeValue);
  }
}

function loadHistory() {
  fetch('/api/history')
    .then((response) => response.json())
    .then((payload) => {
      dom.statusPort.textContent = `Port ${payload.status?.port ?? 'N/A'}`;
      dom.statusBaud.textContent = `Baud ${payload.status?.baud ?? '0'}`;
      setStatus(payload.status?.message ?? 'Connecting');
      handleSamples(payload.samples ?? []);
    })
    .catch(() => {
      setStatus('History load error');
    });
}

function bindSocket() {
  const socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    setStatus('Streaming');
  });

  socket.on('disconnect', () => {
    setStatus('Disconnected');
  });

  socket.on('status', (payload) => {
    setStatus(payload?.message ?? 'Connecting');
  });

  socket.on('data', (payload) => {
    setStatus(payload?.status ?? 'Streaming');
    handleSamples(payload?.samples ?? []);
  });
}

loadHistory();
bindSocket();
