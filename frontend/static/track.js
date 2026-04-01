const mode = document.body.dataset.trackMode || 'gps';
const EARTH_RADIUS_M = 6378137;

const state = {
  firstTimestamp: null,
  latestSample: {},
  latestTime: 0,
  gpsRefLat: null,
  gpsRefLon: null,
  localGpsSource: null,
  latestGpsPoint: null,
  latestInsPoint: null,
};

function latestLocalInsPoint(sample) {
  if (Number.isFinite(sample.prop_pe) && Number.isFinite(sample.prop_pn)) {
    return { x: sample.prop_pe, y: sample.prop_pn };
  }

  if (Number.isFinite(sample.ins_pe) && Number.isFinite(sample.ins_pn)) {
    return { x: sample.ins_pe, y: sample.ins_pn };
  }

  if (Number.isFinite(sample.corr_x_pe) && Number.isFinite(sample.corr_x_pn)) {
    return { x: sample.corr_x_pe, y: sample.corr_x_pn };
  }

  return null;
}

const dom = {
  pageTitle: document.getElementById('page-title'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  heroSummary: document.getElementById('hero-summary'),
  statusBadge: document.getElementById('status-badge'),
  statusPort: document.getElementById('status-port'),
  statusBaud: document.getElementById('status-baud'),
  sampleClock: document.getElementById('sample-clock'),
  clearBtn: document.getElementById('clear-btn'),
};

function formatNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}

function sampleTimeSeconds(sample) {
  const tickMs = Number(sample?.tick_ms);
  if (Number.isFinite(tickMs)) {
    return tickMs * 1.0e-3;
  }

  const timestamp = Number(sample?.timestamp);
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  const relativeTime = Number(sample?.t);
  if (Number.isFinite(relativeTime)) {
    return relativeTime;
  }

  return null;
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

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function projectGpsToMeters(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  if (!Number.isFinite(state.gpsRefLat) || !Number.isFinite(state.gpsRefLon)) {
    state.gpsRefLat = lat;
    state.gpsRefLon = lon;
  }

  const lat0Rad = state.gpsRefLat * Math.PI / 180;
  const dLat = (lat - state.gpsRefLat) * Math.PI / 180;
  const dLon = (lon - state.gpsRefLon) * Math.PI / 180;

  return {
    x: dLon * Math.cos(lat0Rad) * EARTH_RADIUS_M,
    y: dLat * EARTH_RADIUS_M,
  };
}

function localGpsPointFromSample(sample) {
  if (sample?.kind === 'gps_ned' && Number.isFinite(sample.ned_e) && Number.isFinite(sample.ned_n)) {
    return { x: sample.ned_e, y: sample.ned_n };
  }

  if (state.localGpsSource === 'ned') {
    return null;
  }

  if (sample?.kind === 'telemetry' && Number.isFinite(sample.lat) && Number.isFinite(sample.lon)) {
    return projectGpsToMeters(sample.lat, sample.lon);
  }

  return null;
}

function resetGpsTrackDatasets() {
  chart.data.datasets[0].data.length = 0;
  chart.data.datasets[2].data.length = 0;
}

function makeChart() {
  const context = document.getElementById('track-chart').getContext('2d');

  if (mode === 'local') {
    return new Chart(context, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'GPS Measurement',
            data: [],
            showLine: true,
            borderColor: css('--c-ned-e') || '#86f7b8',
            backgroundColor: 'rgba(134, 247, 184, 0.18)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.12,
          },
          {
            label: 'INS Live Track',
            data: [],
            showLine: true,
            borderColor: css('--c-prop-pn') || '#7dc8ff',
            backgroundColor: 'rgba(125, 200, 255, 0.18)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.12,
          },
          {
            label: 'GPS Current',
            data: [],
            showLine: false,
            borderColor: css('--c-ned-e') || '#86f7b8',
            backgroundColor: css('--c-ned-e') || '#86f7b8',
            pointRadius: 4,
            pointHoverRadius: 5,
          },
          {
            label: 'INS Live',
            data: [],
            showLine: false,
            borderColor: css('--c-prop-pn') || '#7dc8ff',
            backgroundColor: css('--c-prop-pn') || '#7dc8ff',
            pointRadius: 4,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        plugins: {
          legend: { display: true, labels: { color: '#91a4bf', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label(context) {
                const point = context.raw || {};
                return `${context.dataset.label}: E ${formatNumber(point.x, 3)}, N ${formatNumber(point.y, 3)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(132, 156, 189, 0.13)' },
            ticks: { color: '#7f92ad' },
            title: { display: true, text: 'East [m]', color: '#7f92ad' },
          },
          y: {
            grid: { color: 'rgba(132, 156, 189, 0.13)' },
            ticks: { color: '#7f92ad' },
            title: { display: true, text: 'North [m]', color: '#7f92ad' },
          },
        },
      },
    });
  }

  return new Chart(context, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'GPS Projected Track',
          data: [],
          showLine: true,
          borderColor: css('--accent') || '#42d5ff',
          backgroundColor: 'rgba(66, 213, 255, 0.22)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.12,
        },
        {
          label: 'GPS Current',
          data: [],
          showLine: false,
          borderColor: css('--accent') || '#42d5ff',
          backgroundColor: css('--accent') || '#42d5ff',
          pointRadius: 4,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { display: true, labels: { color: '#91a4bf', boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw || {};
              return `${context.dataset.label}: E ${formatNumber(point.x, 3)}, N ${formatNumber(point.y, 3)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(132, 156, 189, 0.13)' },
          ticks: { color: '#7f92ad' },
          title: { display: true, text: 'East [m]', color: '#7f92ad' },
        },
        y: {
          grid: { color: 'rgba(132, 156, 189, 0.13)' },
          ticks: { color: '#7f92ad' },
          title: { display: true, text: 'North [m]', color: '#7f92ad' },
        },
      },
    },
  });
}

const chart = makeChart();

function configurePage() {
  if (mode === 'local') {
    dom.pageTitle.textContent = 'Local N/E Track';
    dom.heroSubtitle.textContent = 'GPS Measurement vs INS Live Position';
    dom.heroSummary.textContent = 'GPS N/E measurements and live INS position overlaid in local North-East coordinates';
  } else {
    dom.pageTitle.textContent = 'GPS Track';
    dom.heroSubtitle.textContent = 'Projected GPS Trajectory';
    dom.heroSummary.textContent = 'GPS latitude/longitude projected into local meter coordinates for distortion-free viewing';
  }
}

function mergeSample(sample) {
  for (const [key, value] of Object.entries(sample || {})) {
    if (key === 'timestamp' || key === 't' || key === 'kind') {
      continue;
    }
    state.latestSample[key] = value;
  }

  if (sample?.ref_valid === 1 && Number.isFinite(sample.ref_lat) && Number.isFinite(sample.ref_lon)) {
    state.gpsRefLat = sample.ref_lat;
    state.gpsRefLon = sample.ref_lon;
  }
}

function pushPoint(sample) {
  if (mode === 'local') {
    if (sample?.kind === 'gps_ned' && state.localGpsSource !== 'ned') {
      state.localGpsSource = 'ned';
      resetGpsTrackDatasets();
    } else if (sample?.kind === 'telemetry' && state.localGpsSource == null) {
      state.localGpsSource = 'projected';
    }

    const gpsPoint = localGpsPointFromSample(sample);
    if (gpsPoint) {
      state.latestGpsPoint = gpsPoint;
      chart.data.datasets[0].data.push(gpsPoint);
      chart.data.datasets[2].data = [gpsPoint];
    }

    const insPoint = latestLocalInsPoint(sample);
    if (insPoint) {
      state.latestInsPoint = insPoint;
      chart.data.datasets[1].data.push(insPoint);
      chart.data.datasets[3].data = [insPoint];
    }
  } else if (Number.isFinite(sample.lon) && Number.isFinite(sample.lat)) {
    const point = projectGpsToMeters(sample.lat, sample.lon);
    if (point) {
      chart.data.datasets[0].data.push(point);
      chart.data.datasets[1].data = [point];
    }
  }

  for (const dataset of chart.data.datasets) {
    if (dataset.data.length > 4000) {
      dataset.data.splice(0, dataset.data.length - 4000);
    }
  }
}

function updateSummary(timeValue) {
  dom.sampleClock.textContent = `t = ${formatNumber(timeValue, 2)} s`;

  if (mode === 'local') {
    const gpsPoint = state.latestGpsPoint;
    const insPoint = state.latestInsPoint;
    dom.heroSummary.textContent =
      `GPS Live (${formatNumber(gpsPoint?.y, 3)}, ${formatNumber(gpsPoint?.x, 3)})  `
      + `INS Live (${formatNumber(insPoint?.y, 3)}, ${formatNumber(insPoint?.x, 3)})`;
  } else {
    const point = projectGpsToMeters(state.latestSample.lat, state.latestSample.lon);
    dom.heroSummary.textContent =
      `Lat ${formatNumber(state.latestSample.lat, 7)}  Lon ${formatNumber(state.latestSample.lon, 7)}  `
      + `Fix ${Number.isFinite(state.latestSample.fix) ? state.latestSample.fix : '-'}  `
      + `E ${formatNumber(point?.x, 3)}  N ${formatNumber(point?.y, 3)}`;
  }
}

function fitTrackAxes() {
  const points = [];

  for (const dataset of chart.data.datasets) {
    for (const point of dataset.data) {
      if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
        points.push(point);
      }
    }
  }

  if (!points.length) {
    return;
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const centerX = 0.5 * (minX + maxX);
  const centerY = 0.5 * (minY + maxY);
  const spanX = Math.max(maxX - minX, 1.0);
  const spanY = Math.max(maxY - minY, 1.0);
  const span = Math.max(spanX, spanY);
  const paddedHalfSpan = 0.5 * span * 1.12;

  chart.options.scales.x.min = centerX - paddedHalfSpan;
  chart.options.scales.x.max = centerX + paddedHalfSpan;
  chart.options.scales.y.min = centerY - paddedHalfSpan;
  chart.options.scales.y.max = centerY + paddedHalfSpan;
}

function handleSamples(samples) {
  if (!Array.isArray(samples) || !samples.length) {
    return;
  }

  if (state.firstTimestamp == null) {
    const firstTime = sampleTimeSeconds(samples[0]);
    if (Number.isFinite(firstTime)) {
      state.firstTimestamp = firstTime;
    }
  }

  let latestTime = state.latestTime;

  for (const sample of samples) {
    const sampleTime = sampleTimeSeconds(sample);
    const hasTimestamp = Number.isFinite(sampleTime) && Number.isFinite(state.firstTimestamp);
    const timeValue = hasTimestamp
      ? sampleTime - state.firstTimestamp
      : state.latestTime;

    latestTime = Math.max(latestTime, timeValue);
    mergeSample(sample);
    pushPoint(sample);
    updateSummary(timeValue);
  }

  state.latestTime = latestTime;
  fitTrackAxes();
  chart.update('none');
}

function clearTrack() {
  for (const dataset of chart.data.datasets) {
    dataset.data.length = 0;
  }
  state.gpsRefLat = null;
  state.gpsRefLon = null;
  state.localGpsSource = null;
  state.latestGpsPoint = null;
  state.latestInsPoint = null;
  chart.options.scales.x.min = undefined;
  chart.options.scales.x.max = undefined;
  chart.options.scales.y.min = undefined;
  chart.options.scales.y.max = undefined;
  chart.update('none');
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

  socket.on('connect', () => setStatus('Streaming'));
  socket.on('disconnect', () => setStatus('Disconnected'));
  socket.on('status', (payload) => setStatus(payload?.message ?? 'Connecting'));
  socket.on('data', (payload) => {
    setStatus(payload?.status ?? 'Streaming');
    handleSamples(payload?.samples ?? []);
  });
}

configurePage();
dom.clearBtn.addEventListener('click', clearTrack);
loadHistory();
bindSocket();
