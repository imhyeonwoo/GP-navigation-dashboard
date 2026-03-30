Chart.defaults.color = '#91a4bf';
Chart.defaults.font.family = "'Space Grotesk', sans-serif";
Chart.defaults.font.size = 11;

const GRID_COLOR = 'rgba(132, 156, 189, 0.13)';
const TICK_COLOR = '#7f92ad';
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
    panelId: 'panel-quat',
    tileId: 'tile-quat',
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
    panelId: 'panel-gyro',
    tileId: 'tile-gyro',
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
    panelId: 'panel-accel',
    tileId: 'tile-accel',
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
    panelId: 'panel-pcov',
    tileId: 'tile-pcov',
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
    panelId: 'panel-vcov',
    tileId: 'tile-vcov',
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
    panelId: 'panel-ned',
    tileId: 'tile-ned',
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
    panelId: 'panel-align',
    tileId: 'tile-align',
    signals: [
      { key: 'bgx', label: 'bgx', color: '--c-bgx', decimals: 6 },
      { key: 'bgy', label: 'bgy', color: '--c-bgy', decimals: 6 },
      { key: 'bgz', label: 'bgz', color: '--c-bgz', decimals: 6 },
    ],
  },
  {
    title: 'INS Acceleration',
    subtitle: 'Propagation a_n in N/E/D',
    chart: 'prop-accel',
    panelId: 'panel-prop-accel',
    tileId: 'tile-prop-accel',
    signals: [
      { key: 'prop_an', label: 'aN', color: '--c-prop-an', decimals: 4 },
      { key: 'prop_ae', label: 'aE', color: '--c-prop-ae', decimals: 4 },
      { key: 'prop_ad', label: 'aD', color: '--c-prop-ad', decimals: 4 },
    ],
  },
  {
    title: 'INS Velocity',
    subtitle: 'Propagation v_n in N/E/D',
    chart: 'prop-vel',
    panelId: 'panel-prop-vel',
    tileId: 'tile-prop-vel',
    signals: [
      { key: 'prop_vn', label: 'vN', color: '--c-prop-vn', decimals: 4 },
      { key: 'prop_ve', label: 'vE', color: '--c-prop-ve', decimals: 4 },
      { key: 'prop_vd', label: 'vD', color: '--c-prop-vd', decimals: 4 },
    ],
  },
  {
    title: 'INS Position',
    subtitle: 'Propagation p_n in N/E/D',
    chart: 'prop-pos',
    panelId: 'panel-prop-pos',
    tileId: 'tile-prop-pos',
    signals: [
      { key: 'prop_pn', label: 'pN', color: '--c-prop-pn', decimals: 4 },
      { key: 'prop_pe', label: 'pE', color: '--c-prop-pe', decimals: 4 },
      { key: 'prop_pd', label: 'pD', color: '--c-prop-pd', decimals: 4 },
    ],
  },
  {
    title: 'INS Rate',
    subtitle: 'Propagation timing',
    chart: 'prop-rate',
    panelId: 'panel-prop-rate',
    tileId: 'tile-prop-rate',
    signals: [
      { key: 'prop_dt', label: 'dt', color: '--c-prop-dt', decimals: 4 },
      { key: 'prop_rate_hz', label: 'Hz', color: '--c-prop-rate', decimals: 3 },
      { key: 'prop_avg_dt', label: 'avg', color: '--c-prop-avg', decimals: 4 },
      { key: 'prop_min_dt', label: 'min', color: '--c-prop-min', decimals: 4 },
      { key: 'prop_max_dt', label: 'max', color: '--c-prop-max', decimals: 4 },
    ],
  },
  {
    title: 'INS Specific Force',
    subtitle: 'Body-frame f_b',
    chart: 'ins-fb',
    panelId: 'panel-ins-fb',
    tileId: 'tile-ins-fb',
    signals: [
      { key: 'ins_fb_x', label: 'fbx', color: '--c-ins-fbx', decimals: 4 },
      { key: 'ins_fb_y', label: 'fby', color: '--c-ins-fby', decimals: 4 },
      { key: 'ins_fb_z', label: 'fbz', color: '--c-ins-fbz', decimals: 4 },
    ],
  },
  {
    title: 'INS Nav Accel',
    subtitle: 'Navigation-frame a_n',
    chart: 'ins-an',
    panelId: 'panel-ins-an',
    tileId: 'tile-ins-an',
    signals: [
      { key: 'ins_an', label: 'aN', color: '--c-ins-an', decimals: 4 },
      { key: 'ins_ae', label: 'aE', color: '--c-ins-ae', decimals: 4 },
      { key: 'ins_ad', label: 'aD', color: '--c-ins-ad', decimals: 4 },
    ],
  },
  {
    title: 'INS Accel Bias',
    subtitle: 'Body-frame accel bias',
    chart: 'ins-bias',
    panelId: 'panel-ins-bias',
    tileId: 'tile-ins-bias',
    signals: [
      { key: 'ins_bax', label: 'bAx', color: '--c-ins-bax', decimals: 4 },
      { key: 'ins_bay', label: 'bAy', color: '--c-ins-bay', decimals: 4 },
      { key: 'ins_baz', label: 'bAz', color: '--c-ins-baz', decimals: 4 },
    ],
  },
  {
    title: 'Altitude',
    subtitle: 'Altitude view from NED down states',
    chart: 'altitude',
    panelId: 'panel-altitude',
    signals: [
      {
        key: 'alt_gps',
        label: 'GPS Alt',
        color: '--c-alt-gps',
        decimals: 4,
        tension: 0,
        stepped: 'middle',
        borderDash: [8, 5],
        borderWidth: 2.2,
      },
      {
        key: 'alt_ins',
        label: 'INS Alt',
        color: '--c-alt-ins',
        decimals: 4,
        tension: 0.14,
        borderWidth: 2.8,
      },
    ],
  },
  {
    title: 'INS Covariance Sigma',
    subtitle: '1-sigma from P diag',
    chart: 'ins-sigma',
    panelId: 'panel-ins-sigma',
    tileId: 'tile-ins-sigma',
    signals: [
      { key: 'ins_sig_pn', label: 'sigPn', color: '--c-ins-sig-pn', decimals: 4 },
      { key: 'ins_sig_pe', label: 'sigPe', color: '--c-ins-sig-pe', decimals: 4 },
      { key: 'ins_sig_pd', label: 'sigPd', color: '--c-ins-sig-pd', decimals: 4 },
      { key: 'ins_sig_vn', label: 'sigVn', color: '--c-ins-sig-vn', decimals: 4 },
      { key: 'ins_sig_ve', label: 'sigVe', color: '--c-ins-sig-ve', decimals: 4 },
      { key: 'ins_sig_vd', label: 'sigVd', color: '--c-ins-sig-vd', decimals: 4 },
    ],
  },
  {
    title: 'GPS Correction z',
    subtitle: 'Measurement vector',
    chart: 'corr-z',
    panelId: 'panel-corr-z',
    signals: [
      { key: 'corr_z_pn', label: 'zPn', color: '--c-corr-z-pn', decimals: 4 },
      { key: 'corr_z_pe', label: 'zPe', color: '--c-corr-z-pe', decimals: 4 },
      { key: 'corr_z_pd', label: 'zPd', color: '--c-corr-z-pd', decimals: 4 },
      { key: 'corr_z_vn', label: 'zVn', color: '--c-corr-z-vn', decimals: 4 },
      { key: 'corr_z_ve', label: 'zVe', color: '--c-corr-z-ve', decimals: 4 },
      { key: 'corr_z_vd', label: 'zVd', color: '--c-corr-z-vd', decimals: 4 },
    ],
  },
  {
    title: 'GPS Innovation',
    subtitle: 'Innovation y',
    chart: 'corr-y',
    panelId: 'panel-corr-y',
    tileId: 'tile-corr-y',
    signals: [
      { key: 'corr_y_pn', label: 'yPn', color: '--c-corr-y-pn', decimals: 4 },
      { key: 'corr_y_pe', label: 'yPe', color: '--c-corr-y-pe', decimals: 4 },
      { key: 'corr_y_pd', label: 'yPd', color: '--c-corr-y-pd', decimals: 4 },
      { key: 'corr_y_vn', label: 'yVn', color: '--c-corr-y-vn', decimals: 4 },
      { key: 'corr_y_ve', label: 'yVe', color: '--c-corr-y-ve', decimals: 4 },
      { key: 'corr_y_vd', label: 'yVd', color: '--c-corr-y-vd', decimals: 4 },
    ],
  },
  {
    title: 'Correction Delta',
    subtitle: 'Injected dx',
    chart: 'corr-dx',
    panelId: 'panel-corr-dx',
    tileId: 'tile-corr-dx',
    signals: [
      { key: 'corr_dx_pn', label: 'dxPn', color: '--c-corr-dx-pn', decimals: 4 },
      { key: 'corr_dx_pe', label: 'dxPe', color: '--c-corr-dx-pe', decimals: 4 },
      { key: 'corr_dx_pd', label: 'dxPd', color: '--c-corr-dx-pd', decimals: 4 },
      { key: 'corr_dx_vn', label: 'dxVn', color: '--c-corr-dx-vn', decimals: 4 },
      { key: 'corr_dx_ve', label: 'dxVe', color: '--c-corr-dx-ve', decimals: 4 },
      { key: 'corr_dx_vd', label: 'dxVd', color: '--c-corr-dx-vd', decimals: 4 },
    ],
  },
  {
    title: 'Corrected State',
    subtitle: 'State after GNSS update',
    chart: 'corr-x',
    panelId: 'panel-corr-x',
    signals: [
      { key: 'corr_x_pn', label: 'xPn', color: '--c-corr-x-pn', decimals: 4 },
      { key: 'corr_x_pe', label: 'xPe', color: '--c-corr-x-pe', decimals: 4 },
      { key: 'corr_x_pd', label: 'xPd', color: '--c-corr-x-pd', decimals: 4 },
      { key: 'corr_x_vn', label: 'xVn', color: '--c-corr-x-vn', decimals: 4 },
      { key: 'corr_x_ve', label: 'xVe', color: '--c-corr-x-ve', decimals: 4 },
      { key: 'corr_x_vd', label: 'xVd', color: '--c-corr-x-vd', decimals: 4 },
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

const DERIVED_SIGNAL_SOURCES = {
  alt_gps: ['ned_d'],
  alt_ins: ['ins_pd', 'corr_x_pd', 'prop_pd'],
};

const state = {
  firstTimestamp: null,
  latestTime: 0,
  sampleCount: 0,
  timeWindow: 30,
  paused: false,
  pendingRedraw: false,
  latestSample: {},
  hiddenGroups: new Set(),
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
  infoPropAccel: document.getElementById('info-prop-accel'),
  infoPropVel: document.getElementById('info-prop-vel'),
  infoPropPos: document.getElementById('info-prop-pos'),
  infoPropRate: document.getElementById('info-prop-rate'),
  infoInsFb: document.getElementById('info-ins-fb'),
  infoInsAn: document.getElementById('info-ins-an'),
  infoInsBias: document.getElementById('info-ins-bias'),
  infoInsSigma: document.getElementById('info-ins-sigma'),
  infoCorrY: document.getElementById('info-corr-y'),
  infoCorrDx: document.getElementById('info-corr-dx'),
  summaryQuat: document.getElementById('summary-quat'),
  summaryGyro: document.getElementById('summary-gyro'),
  summaryAccel: document.getElementById('summary-accel'),
  summaryPcov: document.getElementById('summary-pcov'),
  summaryVcov: document.getElementById('summary-vcov'),
  summaryNed: document.getElementById('summary-ned'),
  summaryAlign: document.getElementById('summary-align'),
  summaryPropAccel: document.getElementById('summary-prop-accel'),
  summaryPropVel: document.getElementById('summary-prop-vel'),
  summaryPropPos: document.getElementById('summary-prop-pos'),
  summaryPropRate: document.getElementById('summary-prop-rate'),
  summaryInsFb: document.getElementById('summary-ins-fb'),
  summaryInsAn: document.getElementById('summary-ins-an'),
  summaryInsBias: document.getElementById('summary-ins-bias'),
  summaryAltitude: document.getElementById('summary-altitude'),
  summaryInsSigma: document.getElementById('summary-ins-sigma'),
  summaryCorrZ: document.getElementById('summary-corr-z'),
  summaryCorrY: document.getElementById('summary-corr-y'),
  summaryCorrDx: document.getElementById('summary-corr-dx'),
  summaryCorrX: document.getElementById('summary-corr-x'),
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

const charts = {};

for (const group of SIGNAL_GROUPS) {
  charts[group.chart] = makeTimeChart(
    `chart-${group.chart}`,
    group.signals.map((signal) => ({
      label: signal.label,
      data: [],
      borderColor: css(signal.color),
      backgroundColor: css(signal.color),
      borderDash: signal.borderDash ?? [],
      borderWidth: signal.borderWidth ?? 2,
      stepped: signal.stepped ?? false,
      tension: signal.tension ?? 0.18,
      pointRadius: signal.pointRadius ?? 0,
      pointHoverRadius: signal.pointHoverRadius ?? 3,
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

    const showButton = document.createElement('button');
    showButton.type = 'button';
    showButton.className = 'group-btn';
    showButton.id = `group-display-${group.chart}`;
    showButton.addEventListener('click', () => {
      setGroupDisplay(group, state.hiddenGroups.has(group.chart));
    });

    actions.append(allButton, noneButton, showButton);
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

  for (const group of SIGNAL_GROUPS) {
    updateGroupDisplayButton(group);
  }
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

function updateGroupDisplayButton(group) {
  const button = document.getElementById(`group-display-${group.chart}`);
  if (!button) {
    return;
  }

  const hidden = state.hiddenGroups.has(group.chart);
  button.textContent = hidden ? 'Show' : 'Hide';
  button.classList.toggle('toggle-off', hidden);
}

function setGroupDisplay(group, visible) {
  const panelNode = group.panelId ? document.getElementById(group.panelId) : null;
  const tileNode = group.tileId ? document.getElementById(group.tileId) : null;

  if (visible) {
    state.hiddenGroups.delete(group.chart);
  } else {
    state.hiddenGroups.add(group.chart);
  }

  panelNode?.classList.toggle('is-hidden', !visible);
  tileNode?.classList.toggle('is-hidden', !visible);
  updateGroupDisplayButton(group);
}

function updateXAxis() {
  const xMax = Math.max(state.latestTime, state.timeWindow);
  const xMin = Math.max(0, xMax - state.timeWindow);

  for (const [name, chart] of Object.entries(charts)) {
    chart.options.scales.x.min = xMin;
    chart.options.scales.x.max = xMax;
  }
}

function trimTimeSeries() {
  const cutoff = Math.max(0, state.latestTime - state.timeWindow - 5);

  for (const [name, chart] of Object.entries(charts)) {
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

function mergeSample(sample) {
  for (const [key, value] of Object.entries(sample || {})) {
    if (key === 'timestamp' || key === 't' || key === 'kind') {
      continue;
    }
    state.latestSample[key] = value;
  }

  if (Number.isFinite(state.latestSample.ned_d)) {
    state.latestSample.alt_gps = -state.latestSample.ned_d;
  }

  if (Number.isFinite(state.latestSample.ins_pd)) {
    state.latestSample.alt_ins = -state.latestSample.ins_pd;
  } else if (Number.isFinite(state.latestSample.corr_x_pd)) {
    state.latestSample.alt_ins = -state.latestSample.corr_x_pd;
  } else if (Number.isFinite(state.latestSample.prop_pd)) {
    state.latestSample.alt_ins = -state.latestSample.prop_pd;
  }
}

function derivedSignalValue(sample, key) {
  const sourceKeys = DERIVED_SIGNAL_SOURCES[key];
  if (!sourceKeys) {
    return Number.NaN;
  }

  for (const sourceKey of sourceKeys) {
    if (Number.isFinite(sample[sourceKey])) {
      return state.latestSample[key];
    }
  }

  return Number.NaN;
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
  dom.infoPropAccel.textContent = `(${formatNumber(sample.prop_an, 4)}, ${formatNumber(sample.prop_ae, 4)}, ${formatNumber(sample.prop_ad, 4)})`;
  dom.infoPropVel.textContent = `(${formatNumber(sample.prop_vn, 4)}, ${formatNumber(sample.prop_ve, 4)}, ${formatNumber(sample.prop_vd, 4)})`;
  dom.infoPropPos.textContent = `(${formatNumber(sample.prop_pn, 4)}, ${formatNumber(sample.prop_pe, 4)}, ${formatNumber(sample.prop_pd, 4)})`;
  dom.infoPropRate.textContent = `dt ${formatNumber(sample.prop_dt, 4)}  Hz ${formatNumber(sample.prop_rate_hz, 3)}  avg ${formatNumber(sample.prop_avg_dt, 4)}`;
  dom.infoInsFb.textContent = `(${formatNumber(sample.ins_fb_x, 4)}, ${formatNumber(sample.ins_fb_y, 4)}, ${formatNumber(sample.ins_fb_z, 4)})`;
  dom.infoInsAn.textContent = `(${formatNumber(sample.ins_an, 4)}, ${formatNumber(sample.ins_ae, 4)}, ${formatNumber(sample.ins_ad, 4)})`;
  dom.infoInsBias.textContent = `(${formatNumber(sample.ins_bax, 4)}, ${formatNumber(sample.ins_bay, 4)}, ${formatNumber(sample.ins_baz, 4)})`;
  dom.infoInsSigma.textContent = `(${formatNumber(sample.ins_sig_pn, 3)}, ${formatNumber(sample.ins_sig_pe, 3)}, ${formatNumber(sample.ins_sig_pd, 3)}, ${formatNumber(sample.ins_sig_vn, 3)}, ${formatNumber(sample.ins_sig_ve, 3)}, ${formatNumber(sample.ins_sig_vd, 3)})`;
  dom.infoCorrY.textContent = `(${formatNumber(sample.corr_y_pn, 4)}, ${formatNumber(sample.corr_y_pe, 4)}, ${formatNumber(sample.corr_y_pd, 4)}, ${formatNumber(sample.corr_y_vn, 4)}, ${formatNumber(sample.corr_y_ve, 4)}, ${formatNumber(sample.corr_y_vd, 4)})`;
  dom.infoCorrDx.textContent = `(${formatNumber(sample.corr_dx_pn, 4)}, ${formatNumber(sample.corr_dx_pe, 4)}, ${formatNumber(sample.corr_dx_pd, 4)}, ${formatNumber(sample.corr_dx_vn, 4)}, ${formatNumber(sample.corr_dx_ve, 4)}, ${formatNumber(sample.corr_dx_vd, 4)})`;
  dom.sampleClock.textContent = `t = ${formatNumber(timeValue, 2)} s`;
  dom.summaryQuat.textContent = `qw ${formatNumber(sample.qw, 4)}  qx ${formatNumber(sample.qx, 4)}  qy ${formatNumber(sample.qy, 4)}  qz ${formatNumber(sample.qz, 4)}`;
  dom.summaryGyro.textContent = `gx ${formatNumber(sample.gx, 4)}  gy ${formatNumber(sample.gy, 4)}  gz ${formatNumber(sample.gz, 4)}`;
  dom.summaryAccel.textContent = `ax ${formatNumber(sample.ax, 4)}  ay ${formatNumber(sample.ay, 4)}  az ${formatNumber(sample.az, 4)}`;
  dom.summaryPcov.textContent = `pcn ${formatNumber(sample.pcn, 4)}  pce ${formatNumber(sample.pce, 4)}  pcd ${formatNumber(sample.pcd, 4)}`;
  dom.summaryVcov.textContent = `vcn ${formatNumber(sample.vcn, 4)}  vce ${formatNumber(sample.vce, 4)}  vcd ${formatNumber(sample.vcd, 4)}`;
  dom.summaryNed.textContent = `N ${formatNumber(sample.ned_n, 3)}  E ${formatNumber(sample.ned_e, 3)}  D ${formatNumber(sample.ned_d, 3)}`;
  dom.summaryAlign.textContent = `bgx ${formatNumber(sample.bgx, 6)}  bgy ${formatNumber(sample.bgy, 6)}  bgz ${formatNumber(sample.bgz, 6)}`;
  dom.summaryPropAccel.textContent = `aN ${formatNumber(sample.prop_an, 4)}  aE ${formatNumber(sample.prop_ae, 4)}  aD ${formatNumber(sample.prop_ad, 4)}`;
  dom.summaryPropVel.textContent = `vN ${formatNumber(sample.prop_vn, 4)}  vE ${formatNumber(sample.prop_ve, 4)}  vD ${formatNumber(sample.prop_vd, 4)}`;
  dom.summaryPropPos.textContent = `pN ${formatNumber(sample.prop_pn, 4)}  pE ${formatNumber(sample.prop_pe, 4)}  pD ${formatNumber(sample.prop_pd, 4)}`;
  dom.summaryPropRate.textContent = `dt ${formatNumber(sample.prop_dt, 4)}  Hz ${formatNumber(sample.prop_rate_hz, 3)}  avg ${formatNumber(sample.prop_avg_dt, 4)}  min ${formatNumber(sample.prop_min_dt, 4)}  max ${formatNumber(sample.prop_max_dt, 4)}`;
  dom.summaryInsFb.textContent = `fbx ${formatNumber(sample.ins_fb_x, 4)}  fby ${formatNumber(sample.ins_fb_y, 4)}  fbz ${formatNumber(sample.ins_fb_z, 4)}`;
  dom.summaryInsAn.textContent = `aN ${formatNumber(sample.ins_an, 4)}  aE ${formatNumber(sample.ins_ae, 4)}  aD ${formatNumber(sample.ins_ad, 4)}`;
  dom.summaryInsBias.textContent = `bAx ${formatNumber(sample.ins_bax, 4)}  bAy ${formatNumber(sample.ins_bay, 4)}  bAz ${formatNumber(sample.ins_baz, 4)}`;
  dom.summaryAltitude.textContent = `GPS Alt ${formatNumber(sample.alt_gps, 3)}  INS Alt ${formatNumber(sample.alt_ins, 3)}`;
  dom.summaryInsSigma.textContent = `sigPn ${formatNumber(sample.ins_sig_pn, 3)}  sigPe ${formatNumber(sample.ins_sig_pe, 3)}  sigPd ${formatNumber(sample.ins_sig_pd, 3)}  sigVn ${formatNumber(sample.ins_sig_vn, 3)}  sigVe ${formatNumber(sample.ins_sig_ve, 3)}  sigVd ${formatNumber(sample.ins_sig_vd, 3)}`;
  dom.summaryCorrZ.textContent = `zPn ${formatNumber(sample.corr_z_pn, 3)}  zPe ${formatNumber(sample.corr_z_pe, 3)}  zPd ${formatNumber(sample.corr_z_pd, 3)}  zVn ${formatNumber(sample.corr_z_vn, 3)}  zVe ${formatNumber(sample.corr_z_ve, 3)}  zVd ${formatNumber(sample.corr_z_vd, 3)}`;
  dom.summaryCorrY.textContent = `yPn ${formatNumber(sample.corr_y_pn, 3)}  yPe ${formatNumber(sample.corr_y_pe, 3)}  yPd ${formatNumber(sample.corr_y_pd, 3)}  yVn ${formatNumber(sample.corr_y_vn, 3)}  yVe ${formatNumber(sample.corr_y_ve, 3)}  yVd ${formatNumber(sample.corr_y_vd, 3)}`;
  dom.summaryCorrDx.textContent = `dxPn ${formatNumber(sample.corr_dx_pn, 3)}  dxPe ${formatNumber(sample.corr_dx_pe, 3)}  dxPd ${formatNumber(sample.corr_dx_pd, 3)}  dxVn ${formatNumber(sample.corr_dx_vn, 3)}  dxVe ${formatNumber(sample.corr_dx_ve, 3)}  dxVd ${formatNumber(sample.corr_dx_vd, 3)}`;
  dom.summaryCorrX.textContent = `xPn ${formatNumber(sample.corr_x_pn, 3)}  xPe ${formatNumber(sample.corr_x_pe, 3)}  xPd ${formatNumber(sample.corr_x_pd, 3)}  xVn ${formatNumber(sample.corr_x_vn, 3)}  xVe ${formatNumber(sample.corr_x_ve, 3)}  xVd ${formatNumber(sample.corr_x_vd, 3)}`;

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

    mergeSample(sample);

    for (const [key] of signalIndex.entries()) {
      const dataset = datasetForKey(key);
      const value = Number.isFinite(sample[key]) ? sample[key] : derivedSignalValue(sample, key);
      if (!dataset || !Number.isFinite(value)) {
        continue;
      }
      dataset.data.push({ x: timeValue, y: value });
    }

    updateSummary(state.latestSample, timeValue);
  }

  trimTimeSeries();
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

function bindControls() {
  document.querySelectorAll('[data-window]').forEach((button) => {
    button.addEventListener('click', () => setTimeWindow(Number(button.dataset.window)));
  });

  dom.pauseBtn.addEventListener('click', togglePause);
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
