Chart.defaults.color = '#91a4bf';
Chart.defaults.font.family = "'Space Grotesk', sans-serif";
Chart.defaults.font.size = 11;

const GRID_COLOR = 'rgba(132, 156, 189, 0.13)';
const TICK_COLOR = '#7f92ad';
const TRACK_MAX = 1500;
const MAX_KEEP = 4000;

const CROSSHAIR_PLUGIN = {
  id: 'crosshairLine',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) {
      return;
    }

    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    if (x < chartArea.left || x > chartArea.right) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(CROSSHAIR_PLUGIN);

const SIGNAL_GROUPS = [
  {
    title: 'Quaternion',
    subtitle: 'Attitude channels',
    chart: 'quat',
    signals: [
      { key: 'qw', label: 'qw', color: '--c-qw', decimals: 4 },
      { key: 'qx', label: 'qx', color: '--c-qx', decimals: 4 },
      { key: 'qy', label: 'qy', color: '--c-qy', decimals: 4 },
      { key: 'qz', label: 'qz', color: '--c-qz', decimals: 4 },
    ],
  },
  {
    title: 'Gyroscope',
    subtitle: 'Angular rate',
    chart: 'gyro',
    signals: [
      { key: 'gx', label: 'gx', color: '--c-gx', decimals: 4 },
      { key: 'gy', label: 'gy', color: '--c-gy', decimals: 4 },
      { key: 'gz', label: 'gz', color: '--c-gz', decimals: 4 },
    ],
  },
  {
    title: 'Accelerometer',
    subtitle: 'Linear acceleration',
    chart: 'accel',
    signals: [
      { key: 'ax', label: 'ax', color: '--c-ax', decimals: 4 },
      { key: 'ay', label: 'ay', color: '--c-ay', decimals: 4 },
      { key: 'az', label: 'az', color: '--c-az', decimals: 4 },
    ],
  },
  {
    title: 'Position Covariance',
    subtitle: 'N, E, D',
    chart: 'pcov',
    signals: [
      { key: 'pcn', label: 'pcn', color: '--c-pcn', decimals: 4 },
      { key: 'pce', label: 'pce', color: '--c-pce', decimals: 4 },
      { key: 'pcd', label: 'pcd', color: '--c-pcd', decimals: 4 },
    ],
  },
  {
    title: 'Velocity Covariance',
    subtitle: 'N, E, D',
    chart: 'vcov',
    signals: [
      { key: 'vcn', label: 'vcn', color: '--c-vcn', decimals: 4 },
      { key: 'vce', label: 'vce', color: '--c-vce', decimals: 4 },
      { key: 'vcd', label: 'vcd', color: '--c-vcd', decimals: 4 },
    ],
  },
  {
    title: 'GPS NED',
    subtitle: 'Local north-east-down',
    chart: 'ned',
    signals: [
      { key: 'ned_n', label: 'N', color: '--c-ned-n', decimals: 3 },
      { key: 'ned_e', label: 'E', color: '--c-ned-e', decimals: 3 },
      { key: 'ned_d', label: 'D', color: '--c-ned-d', decimals: 3 },
    ],
  },
  {
    title: 'Alignment Bias',
    subtitle: 'Body-frame gyro bias',
    chart: 'align',
    signals: [
      { key: 'bgx', label: 'bgx', color: '--c-bgx', decimals: 6 },
      { key: 'bgy', label: 'bgy', color: '--c-bgy', decimals: 6 },
      { key: 'bgz', label: 'bgz', color: '--c-bgz', decimals: 6 },
    ],
  },
];

const signalIndex = new Map();
for (const group of SIGNAL_GROUPS) {
  for (const signal of group.signals) {
    signal.chart = group.chart;
    signal.group = group.title;
    signalIndex.set(signal.key, signal);
  }
}

const state = {
  firstTimestamp: null,
  latestTime: 0,
  sampleCount: 0,
  timeWindow: 30,
  paused: false,
  pendingRedraw: false,
  latestSample: {},
};

const dom = {
  statusBadge: document.getElementById('status-badge'),
  statusText: document.getElementById('status-text'),
  hdrPort: document.getElementById('hdr-port'),
  hdrBaud: document.getElementById('hdr-baud'),
  hdrSamples: document.getElementById('hdr-samples'),
  hdrTime: document.getElementById('hdr-time'),
  sampleClock: document.getElementById('sample-clock'),
  pauseBtn: document.getElementById('pause-btn'),
  clearTrackBtn: document.getElementById('clear-track-btn'),
  signalBrowser: document.getElementById('signal-browser'),
  infoFix: document.getElementById('info-fix'),
  infoLatLon: document.getElementById('info-latlon'),
  infoQ: document.getElementById('info-q'),
  infoG: document.getElementById('info-g'),
  infoA: document.getElementById('info-a'),
  infoPcov: document.getElementById('info-pcov'),
  infoVcov: document.getElementById('info-vcov'),
  infoNed: document.getElementById('info-ned'),
  infoAlign: document.getElementById('info-align'),
  infoRef: document.getElementById('info-ref'),
  summaryQuat: document.getElementById('summary-quat'),
  summaryGyro: document.getElementById('summary-gyro'),
  summaryAccel: document.getElementById('summary-accel'),
  summaryPcov: document.getElementById('summary-pcov'),
  summaryVcov: document.getElementById('summary-vcov'),
  summaryNed: document.getElementById('summary-ned'),
  summaryAlign: document.getElementById('summary-align'),
};

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}

function setStatus(message) {
  const text = message || 'Connecting';
  dom.statusText.textContent = text;

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
}

function baseScales() {
  return {
    x: {
      type: 'linear',
      min: 0,
      max: state.timeWindow,
      grid: { color: GRID_COLOR },
      ticks: { color: TICK_COLOR, maxTicksLimit: 8 },
      title: { display: true, text: 'Time [s]', color: TICK_COLOR },
    },
    y: {
      grid: { color: GRID_COLOR },
      ticks: { color: TICK_COLOR, maxTicksLimit: 6 },
    },
  };
}

function makeTimeChart(canvasId, datasets) {
  const context = document.getElementById(canvasId).getContext('2d');
  return new Chart(context, {
    type: 'line',
    data: { datasets },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      spanGaps: true,
      interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'x',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 16, 29, 0.96)',
          borderColor: 'rgba(165, 190, 219, 0.18)',
          borderWidth: 1,
          displayColors: true,
        },
      },
      scales: baseScales(),
      elements: {
        point: { radius: 0, hitRadius: 8, hoverRadius: 3 },
        line: { borderWidth: 2, tension: 0.18 },
      },
    },
  });
}

function makeTrackChart() {
  const context = document.getElementById('chart-track').getContext('2d');
  return new Chart(context, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Track',
          data: [],
          showLine: true,
          borderColor: css('--accent'),
          backgroundColor: 'rgba(66, 213, 255, 0.22)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw || {};
              return `lon ${formatNumber(point.x, 7)}, lat ${formatNumber(point.y, 7)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, maxTicksLimit: 6 },
          title: { display: true, text: 'Longitude', color: TICK_COLOR },
        },
        y: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, maxTicksLimit: 6 },
          title: { display: true, text: 'Latitude', color: TICK_COLOR },
        },
      },
    },
  });
}

const charts = {
  track: makeTrackChart(),
};

for (const group of SIGNAL_GROUPS) {
  charts[group.chart] = makeTimeChart(
    `chart-${group.chart}`,
    group.signals.map((signal) => ({
      label: signal.label,
      data: [],
      borderColor: css(signal.color),
      backgroundColor: css(signal.color),
      hidden: false,
    })),
  );
}

function datasetForKey(key) {
  const signal = signalIndex.get(key);
  if (!signal) {
    return null;
  }

  const chart = charts[signal.chart];
  if (!chart) {
    return null;
  }

  return chart.data.datasets.find((dataset) => dataset.label === signal.label) || null;
}

function buildSignalBrowser() {
  const fragment = document.createDocumentFragment();

  for (const group of SIGNAL_GROUPS) {
    const card = document.createElement('section');
    card.className = 'signal-group';

    const header = document.createElement('div');
    header.className = 'signal-group-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'signal-group-title';
    titleWrap.innerHTML = `<strong>${group.title}</strong><span>${group.subtitle}</span>`;

    const actions = document.createElement('div');
    actions.className = 'group-actions';

    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'group-btn';
    allButton.textContent = 'All';
    allButton.addEventListener('click', () => setGroupVisibility(group, true));

    const noneButton = document.createElement('button');
    noneButton.type = 'button';
    noneButton.className = 'group-btn';
    noneButton.textContent = 'None';
    noneButton.addEventListener('click', () => setGroupVisibility(group, false));

    actions.append(allButton, noneButton);
    header.append(titleWrap, actions);

    const list = document.createElement('div');
    list.className = 'signal-list';

    for (const signal of group.signals) {
      const row = document.createElement('label');
      row.className = 'signal-row';
      row.htmlFor = `toggle-${signal.key}`;

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.id = `toggle-${signal.key}`;
      toggle.className = 'signal-toggle';
      toggle.checked = true;
      toggle.addEventListener('change', () => setSignalVisibility(signal.key, toggle.checked));

      const meta = document.createElement('div');
      meta.className = 'signal-meta';

      const name = document.createElement('div');
      name.className = 'signal-name';
      name.innerHTML = `<span class="signal-dot" style="color:${css(signal.color)}; background:${css(signal.color)}"></span>${signal.label}`;

      const chartLabel = document.createElement('div');
      chartLabel.className = 'signal-chart';
      chartLabel.textContent = group.title;

      meta.append(name, chartLabel);

      const value = document.createElement('div');
      value.className = 'signal-value';
      value.id = `value-${signal.key}`;
      value.textContent = '-';

      row.append(toggle, meta, value);
      list.append(row);
    }

    card.append(header, list);
    fragment.append(card);
  }

  dom.signalBrowser.innerHTML = '';
  dom.signalBrowser.append(fragment);
}

function setSignalVisibility(key, visible) {
  const dataset = datasetForKey(key);
  if (!dataset) {
    return;
  }

  dataset.hidden = !visible;
  scheduleRedraw();
}

function setGroupVisibility(group, visible) {
  for (const signal of group.signals) {
    const toggle = document.getElementById(`toggle-${signal.key}`);
    if (toggle) {
      toggle.checked = visible;
    }
    setSignalVisibility(signal.key, visible);
  }
}

function updateXAxis() {
  const xMax = Math.max(state.latestTime, state.timeWindow);
  const xMin = Math.max(0, xMax - state.timeWindow);

  for (const [name, chart] of Object.entries(charts)) {
    if (name === 'track') {
      continue;
    }
    chart.options.scales.x.min = xMin;
    chart.options.scales.x.max = xMax;
  }
}

function trimTimeSeries() {
  const cutoff = Math.max(0, state.latestTime - state.timeWindow - 5);

  for (const [name, chart] of Object.entries(charts)) {
    if (name === 'track') {
      continue;
    }

    for (const dataset of chart.data.datasets) {
      while (dataset.data.length > 1 && dataset.data[1].x < cutoff) {
        dataset.data.shift();
      }
      if (dataset.data.length > MAX_KEEP) {
        dataset.data.splice(0, dataset.data.length - MAX_KEEP);
      }
    }
  }
}

function trimTrack() {
  const track = charts.track.data.datasets[0].data;
  if (track.length > TRACK_MAX) {
    track.splice(0, track.length - TRACK_MAX);
  }
}

function mergeSample(sample) {
  for (const [key, value] of Object.entries(sample || {})) {
    if (key === 'timestamp' || key === 't' || key === 'kind') {
      continue;
    }
    state.latestSample[key] = value;
  }
}

function updateSummary(sample, timeValue) {
  if (!sample) {
    return;
  }

  const fix = Number.isFinite(sample.fix) ? sample.fix : 0;
  dom.infoFix.textContent = String(fix);
  dom.infoFix.className = `fix-badge fix-${Math.max(0, Math.min(fix, 5))}`;
  dom.infoLatLon.textContent = `${formatNumber(sample.lat, 7)}, ${formatNumber(sample.lon, 7)}`;
  dom.infoQ.textContent = `(${formatNumber(sample.qw, 4)}, ${formatNumber(sample.qx, 4)}, ${formatNumber(sample.qy, 4)}, ${formatNumber(sample.qz, 4)})`;
  dom.infoG.textContent = `(${formatNumber(sample.gx, 4)}, ${formatNumber(sample.gy, 4)}, ${formatNumber(sample.gz, 4)})`;
  dom.infoA.textContent = `(${formatNumber(sample.ax, 4)}, ${formatNumber(sample.ay, 4)}, ${formatNumber(sample.az, 4)})`;
  dom.infoPcov.textContent = `(${formatNumber(sample.pcn, 4)}, ${formatNumber(sample.pce, 4)}, ${formatNumber(sample.pcd, 4)})`;
  dom.infoVcov.textContent = `(${formatNumber(sample.vcn, 4)}, ${formatNumber(sample.vce, 4)}, ${formatNumber(sample.vcd, 4)})`;
  dom.infoNed.textContent = `(${formatNumber(sample.ned_n, 3)}, ${formatNumber(sample.ned_e, 3)}, ${formatNumber(sample.ned_d, 3)})`;
  dom.infoAlign.textContent = `(${formatNumber(sample.bgx, 6)}, ${formatNumber(sample.bgy, 6)}, ${formatNumber(sample.bgz, 6)}) ${Number.isFinite(sample.align_samples) && Number.isFinite(sample.align_required) ? `[${sample.align_samples}/${sample.align_required}]` : ''}${sample.align_complete === 1 ? ' done' : ''}`.trim();
  dom.infoRef.textContent = sample.ref_valid === 1
    ? `${formatNumber(sample.ref_lat, 7)}, ${formatNumber(sample.ref_lon, 7)}, h ${formatNumber(sample.ref_h, 3)}`
    : '-';
  dom.sampleClock.textContent = `t = ${formatNumber(timeValue, 2)} s`;
  dom.summaryQuat.textContent = `qw ${formatNumber(sample.qw, 4)}  qx ${formatNumber(sample.qx, 4)}  qy ${formatNumber(sample.qy, 4)}  qz ${formatNumber(sample.qz, 4)}`;
  dom.summaryGyro.textContent = `gx ${formatNumber(sample.gx, 4)}  gy ${formatNumber(sample.gy, 4)}  gz ${formatNumber(sample.gz, 4)}`;
  dom.summaryAccel.textContent = `ax ${formatNumber(sample.ax, 4)}  ay ${formatNumber(sample.ay, 4)}  az ${formatNumber(sample.az, 4)}`;
  dom.summaryPcov.textContent = `pcn ${formatNumber(sample.pcn, 4)}  pce ${formatNumber(sample.pce, 4)}  pcd ${formatNumber(sample.pcd, 4)}`;
  dom.summaryVcov.textContent = `vcn ${formatNumber(sample.vcn, 4)}  vce ${formatNumber(sample.vce, 4)}  vcd ${formatNumber(sample.vcd, 4)}`;
  dom.summaryNed.textContent = `N ${formatNumber(sample.ned_n, 3)}  E ${formatNumber(sample.ned_e, 3)}  D ${formatNumber(sample.ned_d, 3)}`;
  dom.summaryAlign.textContent = `bgx ${formatNumber(sample.bgx, 6)}  bgy ${formatNumber(sample.bgy, 6)}  bgz ${formatNumber(sample.bgz, 6)}`;

  for (const [key, signal] of signalIndex.entries()) {
    const valueNode = document.getElementById(`value-${key}`);
    if (valueNode) {
      valueNode.textContent = formatNumber(sample[key], signal.decimals);
    }
  }
}

function pushSamples(samples) {
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
    state.sampleCount += 1;

    for (const [key] of signalIndex.entries()) {
      const dataset = datasetForKey(key);
      if (!dataset || !Number.isFinite(sample[key])) {
        continue;
      }
      dataset.data.push({ x: timeValue, y: sample[key] });
    }

    if (Number.isFinite(sample.lon) && Number.isFinite(sample.lat)) {
      charts.track.data.datasets[0].data.push({ x: sample.lon, y: sample.lat });
    }

    mergeSample(sample);
    updateSummary(state.latestSample, timeValue);
  }

  trimTimeSeries();
  trimTrack();

  dom.hdrSamples.textContent = String(state.sampleCount);
  dom.hdrTime.textContent = `${formatNumber(state.latestTime, 1)} s`;

  if (!state.paused) {
    updateXAxis();
  }

  scheduleRedraw();
}

function scheduleRedraw() {
  if (state.pendingRedraw) {
    return;
  }

  state.pendingRedraw = true;
  requestAnimationFrame(() => {
    state.pendingRedraw = false;
    for (const chart of Object.values(charts)) {
      chart.update('none');
    }
  });
}

function setTimeWindow(seconds) {
  state.timeWindow = seconds;
  document.querySelectorAll('[data-window]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.window) === seconds);
  });
  updateXAxis();
  scheduleRedraw();
}

function togglePause() {
  state.paused = !state.paused;
  dom.pauseBtn.classList.toggle('active', state.paused);
  dom.pauseBtn.textContent = state.paused ? 'Resume Scroll' : 'Pause Scroll';

  if (!state.paused) {
    updateXAxis();
    scheduleRedraw();
  }
}

function clearTrack() {
  charts.track.data.datasets[0].data.length = 0;
  charts.track.update('none');
}

function bindControls() {
  document.querySelectorAll('[data-window]').forEach((button) => {
    button.addEventListener('click', () => setTimeWindow(Number(button.dataset.window)));
  });

  dom.pauseBtn.addEventListener('click', togglePause);
  dom.clearTrackBtn.addEventListener('click', clearTrack);
}

function loadHistory() {
  fetch('/api/history')
    .then((response) => response.json())
    .then((payload) => {
      dom.hdrPort.textContent = payload.status?.port ?? 'N/A';
      dom.hdrBaud.textContent = payload.status?.baud ?? '0';
      setStatus(payload.status?.message ?? 'Connecting');
      pushSamples(payload.samples ?? []);
    })
    .catch((error) => {
      console.error('History load failed:', error);
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
    pushSamples(payload?.samples ?? []);
  });
}

buildSignalBrowser();
bindControls();
loadHistory();
bindSocket();
