const state = {
  firstTimestamp: null,
  latestSample: {},
  latestTime: 0,
  frameVisibility: {
    nav: true,
    imu: true,
    body: true,
  },
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
  frameBrowser: document.getElementById('frame-browser'),
  axisOverlay: document.getElementById('axis-overlay'),
};

const IDENTITY_DCM = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
];

const C_IMU_TO_BODY = [
  [1.0, 0.0, 0.0],
  [0.0, -1.0, 0.0],
  [0.0, 0.0, -1.0],
];

const NED_TO_THREE = [
  [1.0, 0.0, 0.0],
  [0.0, 0.0, -1.0],
  [0.0, -1.0, 0.0],
];

const IMU_TO_THREE = [
  [1.0, 0.0, 0.0],
  [0.0, 0.0, 1.0],
  [0.0, 1.0, 0.0],
];

const BODY_TO_THREE = [
  [1.0, 0.0, 0.0],
  [0.0, 0.0, -1.0],
  [0.0, -1.0, 0.0],
];

const AXIS_COLORS = {
  x: 0xff6e86,
  y: 0x35e0a1,
  z: 0x4da0ff,
};

const FRAME_DEFS = [
  {
    key: 'nav',
    label: 'n-frame',
    description: 'Reference NED frame: n_x = North, n_y = East, n_z = Down',
    swatch: '#9fb6ff',
    axisLabels: { x: 'n_x N', y: 'n_y E', z: 'n_z D' },
    axisLength: 5.2,
    opacity: 0.42,
    frameToThree: NED_TO_THREE,
  },
  {
    key: 'imu',
    label: 'IMU frame',
    description: 'Mounted sensor frame: i_x = Forward, i_y = Left, i_z = Up',
    swatch: '#7dffcf',
    axisLabels: { x: 'i_x F', y: 'i_y L', z: 'i_z U' },
    axisLength: 4.2,
    opacity: 0.72,
    frameToThree: IMU_TO_THREE,
  },
  {
    key: 'body',
    label: 'b-frame',
    description: 'Derived FRD body frame: b_x = Forward, b_y = Right, b_z = Down',
    swatch: '#4dd8ff',
    axisLabels: { x: 'b_x F', y: 'b_y R', z: 'b_z D' },
    axisLength: 3.3,
    opacity: 1.0,
    frameToThree: BODY_TO_THREE,
  },
];

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

const frameObjects = {};
const axisLabels = [];

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

function wrapTo180(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  let wrapped = ((value + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;
  if (Math.abs(wrapped + 180.0) < 1.0e-9) {
    wrapped = 180.0;
  }
  return Object.is(wrapped, -0) ? 0.0 : wrapped;
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

function quaternionToPoseDegrees(qw, qx, qy, qz) {
  const dcmImuToNav = quaternionToDcm(qw, qx, qy, qz);
  const dcmBodyToNav = mat3Multiply(dcmImuToNav, mat3Transpose(C_IMU_TO_BODY));

  const roll = wrapTo180(Math.atan2(dcmBodyToNav[2][1], dcmBodyToNav[2][2]) * (180.0 / Math.PI));
  const pitch = Math.asin(Math.max(-1.0, Math.min(1.0, -dcmBodyToNav[2][0]))) * (180.0 / Math.PI);
  const yaw = wrapTo180(Math.atan2(dcmBodyToNav[1][0], dcmBodyToNav[0][0]) * (180.0 / Math.PI));

  return {
    roll,
    pitch,
    yaw,
    dcmImuToNav,
    dcmBodyToNav,
  };
}

function makeLine(from, to, color, opacity = 1.0) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1.0, opacity }),
  );
}

function makeFrameTriad(axisLength, opacity, originColor, frameToThree) {
  const group = new THREE.Group();

  const frameToThreeVector = (x, y, z) => new THREE.Vector3(
    (frameToThree[0][0] * x) + (frameToThree[0][1] * y) + (frameToThree[0][2] * z),
    (frameToThree[1][0] * x) + (frameToThree[1][1] * y) + (frameToThree[1][2] * z),
    (frameToThree[2][0] * x) + (frameToThree[2][1] * y) + (frameToThree[2][2] * z),
  );

  const endpoints = {
    x: frameToThreeVector(axisLength, 0, 0),
    y: frameToThreeVector(0, axisLength, 0),
    z: frameToThreeVector(0, 0, axisLength),
  };

  group.add(makeLine(new THREE.Vector3(0, 0, 0), endpoints.x, AXIS_COLORS.x, opacity));
  group.add(makeLine(new THREE.Vector3(0, 0, 0), endpoints.y, AXIS_COLORS.y, opacity));
  group.add(makeLine(new THREE.Vector3(0, 0, 0), endpoints.z, AXIS_COLORS.z, opacity));

  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 8),
    new THREE.MeshBasicMaterial({
      color: originColor,
      transparent: opacity < 1.0,
      opacity,
    }),
  );
  group.add(origin);
  group.userData.axisEndpoints = endpoints;

  return group;
}

function setObjectQuaternionFromDcm(object3d, cFrameToNav, frameToThree) {
  const cThree = mat3Multiply(mat3Multiply(frameToThree, cFrameToNav), mat3Transpose(frameToThree));
  const matrix = new THREE.Matrix4();
  matrix.set(
    cThree[0][0], cThree[0][1], cThree[0][2], 0.0,
    cThree[1][0], cThree[1][1], cThree[1][2], 0.0,
    cThree[2][0], cThree[2][1], cThree[2][2], 0.0,
    0.0, 0.0, 0.0, 1.0,
  );
  object3d.quaternion.setFromRotationMatrix(matrix);
}

function registerAxisLabel(frameKey, axisKey, text) {
  const element = document.createElement('div');
  element.className = `axis-label ${axisKey}-axis`;
  element.textContent = text;
  dom.axisOverlay.appendChild(element);
  axisLabels.push({ frameKey, axisKey, element });
}

function buildFrameBrowser() {
  const fragment = document.createDocumentFragment();

  for (const frameDef of FRAME_DEFS) {
    const row = document.createElement('label');
    row.className = 'frame-row';
    row.htmlFor = `frame-toggle-${frameDef.key}`;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = `frame-toggle-${frameDef.key}`;
    toggle.className = 'signal-toggle';
    toggle.checked = state.frameVisibility[frameDef.key];
    toggle.addEventListener('change', () => {
      setFrameVisibility(frameDef.key, toggle.checked);
    });

    const meta = document.createElement('div');
    meta.className = 'frame-meta';

    const name = document.createElement('div');
    name.className = 'frame-name';
    name.innerHTML = `<span class="frame-swatch" style="color:${frameDef.swatch}; background:${frameDef.swatch}"></span>${frameDef.label}`;

    const desc = document.createElement('div');
    desc.className = 'frame-desc';
    desc.textContent = frameDef.description;

    meta.append(name, desc);
    row.append(toggle, meta);
    fragment.append(row);
  }

  dom.frameBrowser.replaceChildren(fragment);
}

function setFrameVisibility(frameKey, visible) {
  state.frameVisibility[frameKey] = visible;

  if (frameObjects[frameKey]) {
    frameObjects[frameKey].group.visible = visible;
  }

  updateAxisLabels();
}

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  updateAxisLabels();
}

window.addEventListener('resize', resize);

scene.add(new THREE.AmbientLight(0x3c4858, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
keyLight.position.set(8, 10, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x4dd8ff, 0.35);
rimLight.position.set(-8, 6, -5);
scene.add(rimLight);

const grid = new THREE.GridHelper(30, 30, 0x233247, 0x142031);
scene.add(grid);

for (const frameDef of FRAME_DEFS) {
  const group = makeFrameTriad(frameDef.axisLength, frameDef.opacity, frameDef.swatch, frameDef.frameToThree);
  frameObjects[frameDef.key] = { group, def: frameDef };
  scene.add(group);

  registerAxisLabel(frameDef.key, 'x', frameDef.axisLabels.x);
  registerAxisLabel(frameDef.key, 'y', frameDef.axisLabels.y);
  registerAxisLabel(frameDef.key, 'z', frameDef.axisLabels.z);
}

setObjectQuaternionFromDcm(frameObjects.nav.group, IDENTITY_DCM, NED_TO_THREE);

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

const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 5.4), bodyMat);
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

function updateAxisLabels() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  for (const label of axisLabels) {
    const frame = frameObjects[label.frameKey];
    if (!frame || !frame.group.visible) {
      label.element.style.display = 'none';
      continue;
    }

    const endpoint = frame.group.userData.axisEndpoints[label.axisKey];
    const worldPoint = frame.group.localToWorld(endpoint.clone());
    const projected = worldPoint.project(camera);

    if (projected.z < -1.0 || projected.z > 1.0) {
      label.element.style.display = 'none';
      continue;
    }

    const x = ((projected.x + 1.0) * 0.5) * width;
    const y = ((-projected.y + 1.0) * 0.5) * height;

    if (x < -40 || x > width + 40 || y < -24 || y > height + 24) {
      label.element.style.display = 'none';
      continue;
    }

    label.element.style.display = 'block';
    label.element.style.left = `${x}px`;
    label.element.style.top = `${y}px`;
  }
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  camera.position.set(
    orbitTarget.x + (Math.cos(orbitAzimuth) * Math.cos(orbitElevation) * orbitDistance),
    orbitTarget.y + (Math.sin(orbitElevation) * orbitDistance),
    orbitTarget.z + (Math.sin(orbitAzimuth) * Math.cos(orbitElevation) * orbitDistance),
  );
  camera.lookAt(orbitTarget);
  renderer.render(scene, camera);
  updateAxisLabels();
}

function updateReadout(sample, timeValue) {
  if (!sample || !Number.isFinite(sample.qw) || !Number.isFinite(sample.qx) || !Number.isFinite(sample.qy) || !Number.isFinite(sample.qz)) {
    return;
  }

  const q = normalizeQuaternion(sample.qw, sample.qx, sample.qy, sample.qz);
  if (q == null) {
    return;
  }

  const pose = quaternionToPoseDegrees(q.w, q.x, q.y, q.z);

  dom.quatReadout.textContent = `w ${formatNumber(q.w, 4)}  x ${formatNumber(q.x, 4)}  y ${formatNumber(q.y, 4)}  z ${formatNumber(q.z, 4)}`;
  dom.rollValue.textContent = formatDegrees(pose.roll);
  dom.pitchValue.textContent = formatDegrees(pose.pitch);
  dom.yawValue.textContent = formatDegrees(pose.yaw);
  dom.sampleClock.textContent = `t = ${formatNumber(timeValue, 2)} s`;
  dom.fixValue.textContent = Number.isFinite(sample.fix) ? String(sample.fix) : '-';
  dom.latValue.textContent = formatNumber(sample.lat, 7);
  dom.lonValue.textContent = formatNumber(sample.lon, 7);
  dom.gyroValue.textContent = `(${formatNumber(sample.gx, 4)}, ${formatNumber(sample.gy, 4)}, ${formatNumber(sample.gz, 4)})`;
  dom.accelValue.textContent = `(${formatNumber(sample.ax, 4)}, ${formatNumber(sample.ay, 4)}, ${formatNumber(sample.az, 4)})`;

  setObjectQuaternionFromDcm(frameObjects.imu.group, pose.dcmImuToNav, IMU_TO_THREE);
  setObjectQuaternionFromDcm(frameObjects.body.group, pose.dcmBodyToNav, BODY_TO_THREE);
  setObjectQuaternionFromDcm(vehicle, pose.dcmImuToNav, IMU_TO_THREE);
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

buildFrameBrowser();
setFrameVisibility('nav', state.frameVisibility.nav);
setFrameVisibility('imu', state.frameVisibility.imu);
setFrameVisibility('body', state.frameVisibility.body);
resize();
renderLoop();
loadHistory();
bindSocket();
