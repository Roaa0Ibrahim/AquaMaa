/*
 * AquaMaa live sensor module: Supabase data store + the sensor KPI cards, charts, water quality
 * assessment and sensor network panels. All numbers come from SELECT queries on public.readings
 * (via supabase-js) and are derived with window.AquaMaaSensors (public/lib/sensors.js).
 * Nothing in this file creates, simulates or defaults a sensor reading.
 */
(function () {
  'use strict';
  const S = window.AquaMaaSensors;
  let H = null; // helpers supplied by app.js: esc, icon, fmt, api, sparkline, ring, animateIn, setContext

  const COLS = 'id,device_id,well_id,ph,temperature,tds_ppm,created_at,ph_raw,ph_voltage,turbidity_raw,turbidity_voltage';
  const AST = 'Asia/Qatar';
  const fTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: AST });
  const fHM = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: AST });
  const fDay = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: AST });
  const fFull = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: AST });

  /* ========================= store ========================= */
  const st = {
    cfg: null, client: null, channel: null, pollTimer: null, tickTimer: null, recomputeTimer: null, visHandler: null,
    started: false, token: 0, rangeKey: '24h', histKey: null, device: null,
    snapRows: [], histRows: [], histTruncated: false, ids: new Set(), maxId: 0, reloadTimer: null, pollInflight: null,
    loading: true, db: 'unknown', error: null, configError: null, realtime: 'off',
    lastUpdated: null, lastInsertAt: null, network: null, view: null, inflight: null, histInflight: null,
  };
  const subs = new Set();
  let disposer = null;

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  function emit() {
    subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    renderLive();
  }

  function describe(e) {
    const msg = (e && e.message) || String(e);
    const code = e && e.code;
    let hint;
    if (/failed to fetch|networkerror|load failed/i.test(msg)) hint = 'The browser could not reach Supabase. Check the network connection and SUPABASE_URL.';
    else if (code === '42501' || /permission denied|row-level security/i.test(msg)) hint = 'Check the Row Level Security SELECT policy on public.readings for the anon role (see supabase/setup.sql).';
    else if (/invalid api key|jwt/i.test(msg)) hint = 'Check SUPABASE_PUBLISHABLE_KEY.';
    else if (code === 'PGRST205' || /could not find the table/i.test(msg)) hint = 'The table public.readings was not found in the exposed schema.';
    const m = /failed to fetch|networkerror|load failed/i.test(msg) ? 'Network error: could not reach Supabase' : msg;
    return { message: code ? `${m} (code ${code})` : m, hint };
  }

  async function fetchSnapshot() {
    const ops = st.cfg.operations;
    const since = new Date(Date.now() - ops.deviceLookbackHours * 3600000).toISOString();
    const { data, error } = await st.client.from('readings').select(COLS)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(ops.snapshotRowLimit);
    if (error) throw error;
    return data || [];
  }

  async function fetchHistory(rangeKey) {
    const ops = st.cfg.operations, range = st.cfg.ranges[rangeKey];
    const since = new Date(Date.now() - range.ms).toISOString();
    const rows = []; let truncated = false;
    for (let from = 0; from < ops.historyRowCap; from += ops.historyPageSize) {
      const { data, error } = await st.client.from('readings').select(COLS)
        .gte('created_at', since).order('created_at', { ascending: false }).range(from, from + ops.historyPageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < ops.historyPageSize) break;
      if (from + ops.historyPageSize >= ops.historyRowCap) truncated = true;
    }
    return { rows, truncated };
  }

  /* Incremental poll: only rows newer than what we already hold. The small id overlap catches
     rows whose transaction committed after a higher id; duplicates are dropped by id. */
  const ID_OVERLAP = 200;
  async function fetchNewRows() {
    const ops = st.cfg.operations;
    const since = new Date(Date.now() - ops.deviceLookbackHours * 3600000).toISOString();
    const { data, error } = await st.client.from('readings').select(COLS)
      .gt('id', Math.max(0, st.maxId - ID_OVERLAP)).gte('created_at', since)
      .order('id', { ascending: true }).limit(1000);
    if (error) throw error;
    return data || [];
  }
  function indexRows() {
    st.ids = new Set();
    st.maxId = 0;
    for (const r of st.snapRows.concat(st.histRows)) if (r && r.id != null) { st.ids.add(r.id); if (r.id > st.maxId) st.maxId = r.id; }
  }
  /* Adds rows not seen before; returns how many were new. */
  function mergeRows(rows) {
    const ops = st.cfg.operations, range = st.cfg.ranges[st.rangeKey], cut = Date.now() - range.ms;
    let added = 0;
    for (const r of rows) {
      if (!r || typeof r.device_id !== 'string' || !r.created_at || !Number.isFinite(Date.parse(r.created_at))) continue;
      if (r.id != null) { if (st.ids.has(r.id)) continue; st.ids.add(r.id); if (r.id > st.maxId) st.maxId = r.id; }
      st.snapRows.unshift(r);
      if (Date.parse(r.created_at) >= cut) st.histRows.unshift(r);
      added++;
    }
    if (st.snapRows.length > ops.snapshotRowLimit * 2) st.snapRows.length = ops.snapshotRowLimit * 2;
    if (st.histRows.length > ops.historyRowCap + 1000) st.histRows.length = ops.historyRowCap + 1000;
    return added;
  }
  function pollNew() {
    if (st.inflight || st.pollInflight || !st.client) return;
    st.pollInflight = (async () => {
      try {
        const rows = await fetchNewRows();
        if (mergeRows(rows)) st.lastInsertAt = Date.now();
        st.db = 'ok'; st.error = null; st.lastUpdated = Date.now();
      } catch (e) { st.db = 'error'; st.error = describe(e); }
      finally { st.pollInflight = null; recompute(); emit(); }
    })();
  }

  function recompute() {
    if (!st.cfg) return;
    const now = Date.now();
    st.network = S.analyze(st.snapRows, st.histRows, st.cfg, now, st.rangeKey, null);
    st.view = st.device ? S.analyze(st.snapRows, st.histRows, st.cfg, now, st.rangeKey, st.device) : st.network;
  }
  function scheduleRecompute() {
    if (st.recomputeTimer) return;
    st.recomputeTimer = setTimeout(() => { st.recomputeTimer = null; recompute(); emit(); }, 250);
  }

  /* One in-flight request per kind: repeated polls/events never stack up. */
  function loadAll() {
    if (st.inflight || !st.client) return st.inflight;
    const key = st.rangeKey;
    st.inflight = (async () => {
      try {
        const [snap, hist] = await Promise.all([fetchSnapshot(), fetchHistory(key)]);
        st.snapRows = snap; st.histRows = hist.rows; st.histTruncated = hist.truncated; st.histKey = key; indexRows();
        st.db = 'ok'; st.error = null; st.lastUpdated = Date.now();
      } catch (e) { st.db = 'error'; st.error = describe(e); }
      finally {
        st.loading = false; st.inflight = null; recompute(); emit();
        if (st.client && st.histKey !== st.rangeKey && st.db === 'ok') loadHistory();
      }
    })();
    return st.inflight;
  }
  function loadHistory() {
    if (st.histInflight || st.inflight || !st.client) return st.histInflight || st.inflight;
    const key = st.rangeKey;
    st.histInflight = (async () => {
      try {
        const hist = await fetchHistory(key);
        st.histRows = hist.rows; st.histTruncated = hist.truncated; st.histKey = key; indexRows(); st.db = 'ok'; st.error = null; st.lastUpdated = Date.now();
      } catch (e) { st.db = 'error'; st.error = describe(e); }
      finally {
        st.histInflight = null; recompute(); emit();
        if (st.client && st.histKey !== st.rangeKey && st.db === 'ok') loadHistory();
      }
    })();
    return st.histInflight;
  }

  function onInsert(payload) {
    const r = payload && payload.new;
    if (!r || !mergeRows([r])) return;
    st.db = 'ok'; st.error = null; st.lastInsertAt = st.lastUpdated = Date.now();
    scheduleRecompute();
  }

  function subscribeRealtime() {
    if (st.channel || !st.client) return;       // never more than one subscription
    st.realtime = 'connecting';
    st.channel = st.client.channel('aquamaa-readings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, onInsert)
      .subscribe((status) => {
        if (!st.channel) return;
        if (status === 'SUBSCRIBED') { st.realtime = 'subscribed'; loadAll(); }   // catch up on anything missed while connecting
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') st.realtime = 'error';
        else if (status === 'CLOSED') st.realtime = 'closed';
        emit();
      });
  }

  async function start() {
    if (st.started) return;
    st.started = true;
    const token = ++st.token;
    Object.assign(st, { loading: true, db: 'unknown', error: null, configError: null, realtime: 'off', snapRows: [], histRows: [], ids: new Set(), maxId: 0, network: null, view: null, device: null, lastUpdated: null, histKey: null });
    emit();
    try {
      const conf = await H.api('/api/config');
      if (token !== st.token) return;
      st.cfg = conf.sensors; st.rangeKey = st.cfg.defaultRange;
      if (!conf.supabase) { st.configError = conf.configError || 'Supabase is not configured.'; st.loading = false; recompute(); emit(); return; }
      if (!window.supabase || !window.supabase.createClient) { st.configError = 'The Supabase browser library could not be loaded (/vendor/supabase.js).'; st.loading = false; recompute(); emit(); return; }
      st.client = window.supabase.createClient(conf.supabase.url, conf.supabase.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } catch (e) {
      if (token !== st.token || e.message === 'unauthenticated') return;
      st.configError = e.message; st.loading = false; emit(); return;
    }
    await loadAll();
    if (token !== st.token) return;
    subscribeRealtime();
    const ops = st.cfg.operations;
    st.pollTimer = setInterval(() => { if (!document.hidden) pollNew(); }, ops.refreshSeconds * 1000);          // new rows every 5 s
    st.reloadTimer = setInterval(() => { if (!document.hidden) loadAll(); }, (ops.fullReloadSeconds || 300) * 1000); // full resync
    st.tickTimer = setInterval(() => { recompute(); emit(); }, 30000);   // keeps "x min ago" and offline detection current
    st.visHandler = () => { if (!document.hidden) loadAll(); };
    document.addEventListener('visibilitychange', st.visHandler);
  }

  function stop() {
    st.token++; st.started = false;
    clearInterval(st.pollTimer); clearInterval(st.reloadTimer); clearInterval(st.tickTimer); clearTimeout(st.recomputeTimer);
    st.pollTimer = st.reloadTimer = st.tickTimer = st.recomputeTimer = null;
    if (st.visHandler) document.removeEventListener('visibilitychange', st.visHandler);
    st.visHandler = null;
    if (st.client && st.channel) { try { st.client.removeChannel(st.channel); } catch { /* ignore */ } }
    st.channel = null; st.client = null; st.inflight = st.histInflight = st.pollInflight = null;
    unmount();
  }

  function setRange(key) {
    if (!st.cfg || !st.cfg.ranges[key] || key === st.rangeKey) return;
    st.rangeKey = key; recompute(); emit(); loadHistory();
  }
  function setDevice(id) {
    st.device = id || null; recompute(); emit();
  }

  /* ========================= connection indicator ========================= */
  function connection() {
    if (st.configError) return { kind: 'error', label: 'Sensor data unavailable', detail: st.configError };
    if (st.loading) return { kind: 'idle', label: 'Connecting…', detail: 'Loading sensor readings' };
    if (st.db === 'error') return { kind: 'error', label: 'Database error', detail: st.error ? st.error.message : '' };
    const upd = st.lastUpdated ? `Last update ${fTime.format(st.lastUpdated)} AST` : '';
    const every = st.cfg.operations.refreshSeconds;
    if (st.realtime === 'subscribed') return { kind: 'live', label: `Live · ${every}s`, detail: `Checking the database every ${every} s, plus realtime inserts. ${upd}` };
    return { kind: 'live', label: `Live · ${every}s`, detail: `Checking the database every ${every} s (realtime: ${st.realtime}). ${upd}` };
  }
  function renderLive() {
    const node = document.getElementById('live');
    if (!node) return;
    const c = connection();
    node.className = 'live ' + ({ live: '', polling: 'warn', error: 'off', idle: 'idle' }[c.kind] || '');
    const span = node.querySelector('span'); if (span) span.textContent = c.label;
    node.title = c.detail || '';
    const upd = document.getElementById('sb-updated');
    if (upd) upd.innerHTML = `${H.icon('refresh')} Sensor data updated ${st.lastUpdated ? H.esc(fTime.format(st.lastUpdated)) + ' AST' : '—'}`;
    const sn = document.getElementById('sb-sensors');
    if (sn) {
      const a = st.network, ok = st.db === 'ok' && a;
      sn.innerHTML = `<i class="dot ${ok && a.assessment.counts.devicesOffline === 0 && a.assessment.counts.devicesTotal ? '' : 'amber'}"></i>Sensors: <b>${ok ? `${a.assessment.counts.devicesOnline} of ${a.assessment.counts.devicesTotal}` : '—'}</b> devices reporting`;
    }
  }

  /* ========================= formatting ========================= */
  const esc = (v) => H.esc(v);
  const tag = (txt, cls, ic) => `<span class="tag ${cls}">${ic ? H.icon(ic) : '<i></i>'}${esc(txt)}</span>`;
  function ago(t, now) {
    if (t == null) return '—';
    const m = Math.round((now - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
    return `${Math.round(m / 1440)} d ago`;
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const label = (p) => st.cfg.parameters[p].label;
  const DIG = { ph: 2, temperature: 1, tds_ppm: 0, turbidity_raw: 0 };
  const statName = (p) => { const m = S.aggregationFor(p, st.cfg && st.cfg.aggregation).acrossWells; return S.AGG_LABEL[m] || m; };
  function refText(p) {
    const r = st.cfg.parameters[p].reference;
    if (p === 'turbidity_raw') return 'Awaiting calibration';
    if (!r) return 'Not configured';
    if (r.min != null && r.max != null) return `${r.min} – ${r.max}`;
    return r.max != null ? `≤ ${r.max}` : `≥ ${r.min}`;
  }
  const STATE_CLS = { within: 'green', outside: 'amber', critical: 'red', not_assessed: 'grey', no_data: 'grey', awaiting_calibration: 'amber' };
  function paramTag(e) {
    switch (e.state) {
      case 'within': return tag('Within reference', 'green', 'check');
      case 'outside': return tag(e.direction === 'above' ? 'Above reference' : 'Below reference', 'amber', 'alert');
      case 'critical': return tag(`Critical (${e.direction})`, 'red', 'alert');
      case 'not_assessed': return tag('Not assessed', 'grey', 'info');
      case 'awaiting_calibration': return tag('Awaiting calibration', 'amber', 'info');
      default: return tag('No data', 'grey');
    }
  }
  const OVERALL = { normal: ['green', 'check'], attention: ['amber', 'alert'], critical: ['red', 'alert'], insufficient_data: ['grey', 'info'] };

  /* ========================= KPI cards ========================= */
  function shell(o) {
    return `<div class="k-head"><span class="k-ico ${o.ico || ''}">${H.icon(o.icon)}</span>${esc(o.title)}</div>
      <div class="k-body"><div><div class="big${o.skel ? ' skel' : ''}">${o.big}</div><div class="unit">${o.unit || ''}</div></div>${o.right ? `<div class="k-right">${o.right}</div>` : ''}</div>
      ${o.meta ? `<div class="k-meta" title="${o.metaTitle || ''}">${o.meta}</div>` : ''}
      <div class="k-foot">${o.foot || ''}</div>`;
  }
  const NL = '&#10;';
  function trendTag(a, p) {
    const ch = S.seriesChange(a.series[p].points);
    if (!ch) return '';
    const d = DIG[p], delta = ch.delta, flat = Math.abs(delta) < 0.5 * Math.pow(10, -d);
    const txt = flat ? '0' : (delta > 0 ? '+' : '') + delta.toFixed(d);
    const tip = `Change over ${a.range.label.toLowerCase()}: ${ch.from.toFixed(d)} → ${ch.to.toFixed(d)} (network ${statName(p)} of wells, per time bucket)`;
    return `<span class="tag grey" title="${esc(tip)}">${flat ? '' : H.icon(delta > 0 ? 'up' : 'down')}${esc(txt)}</span>`;
  }
  function spark(a, p) { return H.sparkline(a.series[p].points.map((x) => x.value)); }

  function kpiInner(kind) {
    const meta = { ph: ['pH Level', 'flask', 'blue'], temperature: ['Water Temperature', 'thermo', 'amber'], tds_ppm: ['Total Dissolved Solids', 'tds', ''], turbidity_raw: ['Turbidity', 'eye', 'blue'], wq: ['Water quality', 'shield', 'green'] }[kind];
    const base = { title: meta[0], icon: meta[1], ico: meta[2] };
    if (st.configError) return shell({ ...base, big: '—', unit: 'Unavailable', foot: tag('Not configured', 'red', 'alert'), meta: '', });
    if (st.loading || !st.network) return shell({ ...base, big: '…', skel: true, unit: 'Loading' });
    const a = st.network, now = a.now;
    if (kind === 'wq') return wqInner(base, a);
    const s = a.summary[kind], p = kind, d = DIG[p];
    if (st.db === 'error' && !st.snapRows.length) return shell({ ...base, big: '—', unit: 'Unavailable', foot: tag('Database error', 'red', 'alert'), meta: '' });
    if (!st.snapRows.length) return shell({ ...base, big: '—', unit: 'No readings', foot: tag('No data', 'grey') });
    if (!s.count) {
      const last = a.allDevices.length ? Math.max(...a.allDevices.map((x) => (x.latest[p] ? x.latest[p].at : 0))) : 0;
      return shell({ ...base, big: '—', unit: st.cfg.operations.useLastKnownValues === false ? 'No fresh readings' : 'No valid readings', meta: last ? `Last valid ${ago(last, now)}` : 'Never reported', foot: tag(a.allDevices.length ? 'Stale' : 'No data', 'grey') });
    }
    const m = a.metrics;
    const devs = plural(s.count, 'well'), sn = statName(p);
    const srcTxt = `${plural(s.count, 'well')} (${plural(s.devices, 'sensor')})`;
    const when = s.staleWells ? `last known · ${ago(s.latestAt, now)}` : ago(s.latestAt, now);
    const staleTag = s.staleWells ? tag(s.staleWells === s.count ? 'Last known value' : `${s.staleWells} of ${plural(s.count, 'well')} stale`, 'grey', 'info') : '';
    const rangeTxt = `${S.num(s.min) === null ? '' : s.min.toFixed(d)} – ${s.max.toFixed(d)}`;
    const abs = `Latest contributing measurement: ${fFull.format(s.latestAt)} AST`;

    if (kind === 'ph') {
      const e = a.assessment.params.ph;
      const tip = [`${cap(sn)} of the latest reading from each of ${srcTxt}`, `Range across wells: ${rangeTxt}`, `[H⁺]-based mean pH of the wells: ${s.meanByHydrogen.toFixed(2)} (wells are separate water bodies, so this is not a mixed-water pH)`, abs].map(esc).join(NL);
      return shell({ ...base, big: s.value.toFixed(2), unit: `pH · ${sn} of wells`, right: spark(a, p) + trendTag(a, p), meta: `${devs} · ${when}`, metaTitle: tip,
        foot: tag(m.ph.classification, STATE_CLS[e.state], e.state === 'within' ? 'check' : null) + (staleTag || `<span title="Lowest – highest well value">${rangeTxt}</span>`) });
    }
    if (kind === 'temperature') {
      const e = a.assessment.params.temperature;
      const tip = [`${cap(sn)} of the latest reading from each of ${srcTxt}`, `Range across wells: ${rangeTxt} °C`, abs].map(esc).join(NL);
      return shell({ ...base, big: s.value.toFixed(1), unit: `°C · ${sn} of wells`, right: spark(a, p) + trendTag(a, p), meta: `${devs} · ${when}`, metaTitle: tip,
        foot: (e.state === 'not_assessed' ? tag('No threshold set', 'grey', 'info') : paramTag(e)) + (staleTag || `<span title="Lowest – highest well value">${rangeTxt}</span>`) });
    }
    if (kind === 'tds_ppm') {
      const e = a.assessment.params.tds_ppm, dv = a.deviations.tds_ppm;
      const tip = [`${cap(sn)} of the latest reading from each of ${srcTxt}`, `Range across wells: ${rangeTxt} ppm`, `Highest: ${s.maxWell}`, abs].map(esc).join(NL);
      return shell({ ...base, big: H.fmt(s.value, 0), unit: `ppm · ${sn} of wells`, right: spark(a, p) + trendTag(a, p), meta: `${devs} · ${when}`, metaTitle: tip,
        foot: paramTag(e) + (dv && dv.evaluated && dv.flag ? tag('Unusual change', 'amber', 'alert') : (staleTag || `<span title="Lowest – highest well value">${rangeTxt}</span>`)) });
    }
    // turbidity: raw only, never NTU
    const v = a.summary.turbidity_voltage;
    const tip = [`${cap(sn)} raw sensor reading of the latest value from each of ${srcTxt}`, `Raw range across wells: ${rangeTxt}`, 'Not calibrated: no validated NTU conversion exists, so this is not an NTU value.', abs].map(esc).join(NL);
    return shell({ ...base, big: H.fmt(s.value, 0), unit: 'raw reading · not NTU', meta: `${v.count ? `${v.value.toFixed(2)} V · ` : ''}${devs} · ${when}`, metaTitle: tip,
      foot: (staleTag || tag('Reporting', 'green')) + tag('Not calibrated', 'amber', 'info') });
  }

  function wqInner(base, a) {
    const as = a.assessment, c = as.counts;
    if (st.db === 'error' && !st.snapRows.length) return shell({ ...base, big: '—', unit: 'Unavailable', foot: tag('Database error', 'red', 'alert') });
    const [cls, ic] = OVERALL[as.overall];
    const col = { normal: '#16a34a', attention: '#e08a00', critical: '#dc2626', insufficient_data: '#94a3b8' }[as.overall];
    const short = { normal: 'Normal', attention: 'Attention', critical: 'Critical', insufficient_data: 'No data' }[as.overall];
    const ins = as.overall === 'insufficient_data';
    const inRange = c.parametersAssessed - c.parametersOutside;
    const ring = H.ring({ frac: ins ? 0 : inRange / c.parametersAssessed, color: col, size: 70, stroke: 7, center: `<text x="50%" y="53%" text-anchor="middle" font-size="9.5" font-weight="700" fill="${col}">${short}</text>` });
    return shell({ ...base, big: ins ? '—' : `${inRange}/${c.parametersAssessed}`, unit: ins ? 'not enough data' : 'parameters in range', right: ring,
      meta: `${plural(c.wellsTotal, 'well')} · ${c.devicesAttention} sensor${c.devicesAttention === 1 ? '' : 's'} need attention`, metaTitle: esc(as.disclaimer),
      foot: tag(as.label, cls, ic) + `<span title="${esc(as.disclaimer)}">Preliminary</span>` });
  }

  function fillKpis(root, animate) {
    root.querySelectorAll('[data-sensor-kpi]').forEach((node) => {
      node.innerHTML = kpiInner(node.dataset.sensorKpi);
      if (animate) H.animateIn(node); else settle(node);
    });
  }
  /* Updates must not replay entrance animations. */
  function settle(root) {
    root.querySelectorAll('.line-path').forEach((n) => { n.style.transition = 'none'; n.style.strokeDashoffset = '0'; });
    root.querySelectorAll('.line-area').forEach((n) => { n.style.transition = 'none'; n.style.opacity = '1'; });
    root.querySelectorAll('.ring .arc').forEach((n) => { n.style.transition = 'none'; n.style.strokeDasharray = n.dataset.d; });
  }

  /* ========================= time chart ========================= */
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
    const t = [];
    for (let v = Math.floor(lo / step) * step, i = 0; i < 24; v += step, i++) { t.push(Number(v.toFixed(10))); if (v >= hi - step * 1e-9) break; }
    return t;
  }

  function timeChart(host, series, o, animate) {
    const pts = series.points;
    if (!pts.length) { host.innerHTML = '<div class="chart-empty">No readings in this period</div>'; return; }
    const W = Math.max(host.clientWidth || 300, 240), Hh = 168, L = 40, R = 10, T = 10, B = 24;
    let lo = Math.min(...pts.map((p) => p.min)), hi = Math.max(...pts.map((p) => p.max));
    const refs = o.refs ? [o.refs.min, o.refs.max].filter((v) => v != null) : [];
    refs.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const ticks = niceTicks(lo, hi, 4), d0 = ticks[0], d1 = ticks[ticks.length - 1];
    const tstep = ticks[1] - ticks[0], tdec = tstep >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(tstep) - 1e-9));
    const x = (t) => L + ((t - series.start) / (series.end - series.start)) * (W - L - R);
    const bx = (p) => x(Math.min(p.t + series.bucketMs / 2, series.end));   // bucket centre, never past "now"
    const y = (v) => T + (1 - (v - d0) / (d1 - d0)) * (Hh - T - B);
    const segs = []; let cur = [];
    pts.forEach((p, i) => { if (i && p.t - pts[i - 1].t > series.bucketMs * 3) { segs.push(cur); cur = []; } cur.push(p); });
    segs.push(cur);
    const hasBand = pts.some((p) => p.max !== p.min);
    const line = segs.map((sg) => (sg.length === 1 ? '' : `<path class="line-path" pathLength="1" d="${sg.map((p, i) => `${i ? 'L' : 'M'}${bx(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}" fill="none" stroke="${o.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`)).join('');
    const lone = segs.filter((sg) => sg.length === 1).map((sg) => `<circle cx="${bx(sg[0]).toFixed(1)}" cy="${y(sg[0].value).toFixed(1)}" r="2.6" fill="${o.color}"/>`).join('');
    const band = hasBand ? segs.filter((sg) => sg.length > 1).map((sg) => {
      const top = sg.map((p) => `${bx(p).toFixed(1)},${y(p.max).toFixed(1)}`);
      const bot = sg.slice().reverse().map((p) => `${bx(p).toFixed(1)},${y(p.min).toFixed(1)}`);
      return `<polygon class="line-area" points="${top.concat(bot).join(' ')}" fill="${o.color}" fill-opacity=".16"/>`;
    }).join('') : '';
    const long = series.end - series.start > 2 * 86400000;
    const xl = Array.from({ length: 5 }, (_, i) => {
      const t = series.start + (i * (series.end - series.start)) / 4;
      const anchor = i === 0 ? 'start' : i === 4 ? 'end' : 'middle';
      return `<text x="${x(t).toFixed(1)}" y="${Hh - 6}" text-anchor="${anchor}" font-size="11" fill="#5d7589">${(long ? fDay : fHM).format(t)}</text>`;
    }).join('');
    const refLines = refs.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e08a00" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${W - R}" y="${y(v) - 3}" text-anchor="end" font-size="10" fill="#b36b00">ref ${v}</text>`).join('');
    const dg = o.digits;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" height="${Hh}" role="img" aria-label="${esc(o.title)}">
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3eef2"/><text x="${L - 7}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#5d7589">${v.toFixed(tdec)}</text>`).join('')}
      ${refLines}${band}${line}${lone}${xl}
      <line class="hv" y1="${T}" y2="${y(d0)}" stroke="${o.color}" stroke-dasharray="3 3" opacity="0"/>
      <circle class="hd" r="4.5" fill="#fff" stroke="${o.color}" stroke-width="2.2" opacity="0"/>
      <rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${Hh - T - B}" fill="transparent"/></svg><div class="tip multi" style="opacity:0"></div>`;
    const svg = host.firstElementChild, tip = host.querySelector('.tip'), hv = svg.querySelector('.hv'), hd = svg.querySelector('.hd');
    svg.querySelector('.hit').addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
      let best = pts[0], bd = Infinity;
      pts.forEach((p) => { const dd = Math.abs(bx(p) - px); if (dd < bd) { bd = dd; best = p; } });
      const cx = bx(best), cy = y(best.value);
      hv.setAttribute('x1', cx); hv.setAttribute('x2', cx); hv.setAttribute('opacity', '.6');
      hd.setAttribute('cx', cx); hd.setAttribute('cy', cy); hd.setAttribute('opacity', '1');
      tip.innerHTML = `<b>${fDay.format(best.t)} ${fHM.format(best.t)}</b><br>${best.value.toFixed(dg)} ${esc(o.unit)} ${esc(statName(o.key))}` +
        (best.max !== best.min ? `<br>${best.min.toFixed(dg)} – ${best.max.toFixed(dg)} range across wells` : '') + `<br>${plural(best.n, 'well')}`;
      const sw = r.width, pxs = (cx / W) * sw, tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(pxs, tw / 2), sw - tw / 2)}px`;
      tip.style.top = `${(cy / Hh) * r.height - 12}px`;
      tip.style.opacity = '1';
    });
    svg.querySelector('.hit').addEventListener('mouseleave', () => { hv.setAttribute('opacity', '0'); hd.setAttribute('opacity', '0'); tip.style.opacity = '0'; });
    if (animate) H.animateIn(host); else settle(host);
  }

  function chartDefs() {
    const P = st.cfg.parameters;
    return [
      { key: 'ph', title: 'pH over time', unit: 'pH', digits: 2, color: '#0ea5a0', icon: 'flask', refs: P.ph.reference, note: '' },
      { key: 'temperature', title: 'Temperature over time', unit: '°C', digits: 1, color: '#e08a00', icon: 'thermo', refs: P.temperature.reference, note: '' },
      { key: 'tds_ppm', title: 'TDS over time', unit: 'ppm', digits: 0, color: '#2f80ed', icon: 'tds', refs: P.tds_ppm.reference, note: '' },
      { key: 'turbidity_raw', title: 'Turbidity (raw) over time', unit: 'raw', digits: 0, color: '#7c5cbf', icon: 'eye', refs: null, note: 'Raw reading · not NTU' },
    ];
  }
  function chartCardsHTML() {
    return chartDefs().map((c) => `<section class="card panel chart-card" data-chart="${c.key}">
      <div class="panel-head"><div><div class="eyebrow">${H.icon(c.icon)} ${esc(label(c.key).toUpperCase())}</div><h2>${esc(c.title)}</h2></div></div>
      <div class="chart-wrap" data-host><div class="chart-empty">Loading…</div></div>
      <div class="chart-foot"><span class="cf-left"></span><span class="cf-right">${esc(c.note || `${cap(statName(c.key))} across wells`)}</span></div></section>`).join('');
  }
  function fillCharts(root, a, animate) {
    const defs = chartDefs();
    root.querySelectorAll('[data-chart]').forEach((card) => {
      const def = defs.find((d) => d.key === card.dataset.chart), host = card.querySelector('[data-host]');
      if (st.loading || !a) { return; }
      if (st.configError || (st.db === 'error' && !st.snapRows.length)) { host.innerHTML = '<div class="chart-empty">Sensor data unavailable</div>'; card.querySelector('.cf-left').textContent = ''; return; }
      const series = a.series[def.key];
      timeChart(host, series, def, animate);
      const n = series.points.length ? Math.max(...series.points.map((p) => p.n)) : 0;
      card.querySelector('.cf-left').textContent = series.points.length ? `${a.range.label} · ${a.range.bucketMs / 60000 >= 60 ? a.range.bucketMs / 3600000 + ' h' : a.range.bucketMs / 60000 + ' min'} buckets · up to ${plural(n, 'well')}` : a.range.label;
    });
  }

  /* ========================= banner ========================= */
  function bannerHTML() {
    const out = [];
    const item = (kind, title, text) => out.push(`<div class="sensor-banner ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${H.icon('alert')}<div><b>${esc(title)}</b> ${esc(text)}</div></div>`);
    if (st.configError) item('error', 'Sensor data is not configured.', st.configError);
    else if (st.db === 'error' && st.error) item('error', 'Could not read sensor data.', `${st.error.message}${st.error.hint ? ` — ${st.error.hint}` : ''}${st.snapRows.length ? ' Showing the last successful data.' : ''}`);
    else if (!st.loading && st.cfg) {
      const a = st.network;
      if (!st.snapRows.length) item('warn', 'No sensor readings returned.', `The readings table returned no rows for the last ${st.cfg.operations.deviceLookbackHours} hours. If the table does contain data, the Row Level Security SELECT policy for the anon role is probably missing (see supabase/setup.sql).`);
      else if (a && a.allDevices.length && !a.allDevices.some((d) => d.online)) item('warn', 'No device is reporting.', st.cfg.operations.useLastKnownValues === false
        ? `No device has sent a reading in the last ${st.cfg.operations.freshnessMinutes} minutes, so no current network values are shown.`
        : `No device has sent a reading in the last ${st.cfg.operations.freshnessMinutes} minutes. Showing each sensor's last known reading (newest ${ago(Math.max(...a.allDevices.map((d) => d.lastSeen)), a.now)}).`);
    }
    if (st.histTruncated && st.cfg) item('warn', 'Chart history is capped.', `Only the most recent ${st.cfg.operations.historyRowCap.toLocaleString('en-US')} rows of this period were loaded; choose a shorter range for the full detail.`);
    return out.join('');
  }

  /* ========================= assessment + network panels ========================= */
  function assessmentHTML(a) {
    if (st.loading || !a) return '<div class="chart-empty">Loading…</div>';
    const as = a.assessment, c = as.counts, P = st.cfg.parameters;
    const [cls, ic] = OVERALL[as.overall];
    const notAssessed = S.ASSESSED.filter((p) => !(P[p].reference || P[p].critical)).map((p) => label(p)).concat('Turbidity');
    let headline;
    if (as.overall === 'insufficient_data') headline = c.devicesTotal ? 'Not enough valid, fresh measurements of threshold-assessed parameters to produce an assessment.' : 'No devices are reporting, so no assessment can be produced.';
    else if (as.overall === 'normal') headline = `All ${plural(c.parametersAssessed, 'assessed parameter')} are within the configured monitoring thresholds.`;
    else if (as.overall === 'critical') headline = 'At least one measurement exceeds a configured critical threshold.';
    else headline = `${c.parametersOutside} of ${plural(c.parametersAssessed, 'assessed parameter')} ${c.parametersOutside === 1 ? 'has' : 'have'} at least one device outside the configured threshold.`;
    const rows = S.PARAMS.map((p) => {
      const e = as.params[p], d = DIG[p];
      const val = e.value == null ? '—' : (p === 'turbidity_raw' ? `raw ${H.fmt(e.value, 0)}` : `${e.value.toFixed(d)} ${esc(P[p].unit)}`);
      const ch = S.seriesChange(a.series[p].points);
      const chTxt = ch ? `${ch.delta > 0 ? '+' : ''}${ch.delta.toFixed(d)}` : '—';
      const sh = S.outsideShare(a.series[p].points, P[p]);
      const hist = sh ? ` · ${Math.round(sh.share * 100)}% of period outside` : '';
      return `<tr><td><b>${esc(label(p))}</b></td><td>${val}</td><td>${paramTag(e)}</td><td>${esc(refText(p))}</td>
        <td>${e.count}${e.outsideDevices.length ? ` <span class="muted">(${plural(e.outsideDevices.length, 'sensor')} outside)</span>` : ''}</td><td title="Network value, first vs last time bucket in ${esc(a.range.label.toLowerCase())}">${chTxt}<span class="muted">${esc(hist)}</span></td></tr>`;
    }).join('');
    const dev = a.deviations.tds_ppm;
    const unconfirmed = S.ASSESSED.some((p) => (P[p].reference || P[p].critical) && !P[p].confirmed);
    return `<div class="panel-head"><div><div class="eyebrow">${H.icon('shield')} WATER QUALITY ASSESSMENT <span class="info" title="Calculated from the latest valid reading of each well (sensors in the same well are averaged), then combined across wells. Thresholds come from config/thresholds.json.">i</span></div>
        <h2>Preliminary sensor-based indicator</h2></div>${tag(as.label, cls, ic)}</div>
      <p class="wq-headline">${esc(headline)}</p>
      <div class="stat4">
        <div><b>${c.parametersWithData}/${c.parametersTotal}</b><span>Parameters with valid data</span></div>
        <div><b>${c.parametersOutside}</b><span>Outside thresholds</span></div>
        <div><b>${c.devicesAttention}</b><span>Devices needing attention</span></div>
        <div><b>${c.devicesOffline}<small>/${c.devicesTotal}</small></b><span>Devices offline</span></div></div>
      <div class="tbl-wrap"><table class="t wq-table"><thead><tr><th>Parameter</th><th>Network value</th><th>Status</th><th>Reference</th><th>Wells</th><th>Change · ${esc(a.range.label.toLowerCase())}</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${dev && dev.evaluated && dev.flag ? `<div class="note warn">${H.icon('alert')}<span>TDS deviates from its recent history: modified z-score ${dev.z.toFixed(1)} (${esc(dev.direction)} the earlier median of ${H.fmt(dev.baselineMedian, 0)} ppm).</span></div>` : ''}
      <div class="note">${H.icon('info')}<span>${esc(as.disclaimer)} Not assessed: ${esc(notAssessed.join(', '))}. Turbidity is a raw, uncalibrated reading and does not contribute.${unconfirmed ? ' Reference ranges are unconfirmed defaults (see config/thresholds.json).' : ''}</span></div>`;
  }

  function networkHTML(a, interactive) {
    if (st.loading || !a) return '<div class="chart-empty">Loading…</div>';
    const as = a.assessment, c = as.counts, now = a.now;
    const alerts = a.alerts.slice(0, 6);
    const f = (d, p, dg) => (d.fresh[p] ? d.fresh[p].value.toFixed(dg) : '—');
    const rows = (st.device ? a.allDevices : a.devices).map((d) => `<tr data-device="${esc(d.device_id)}" class="${st.device === d.device_id ? 'sel' : ''}" tabindex="0" title="${interactive ? 'Select device' : 'Open Water Quality for this device'}">
        <td><b>${esc(d.device_id)}</b></td><td>${d.well_id != null ? `Well ${d.well_id}` : '—'}</td><td>${d.online ? tag('Online', 'green') : tag('Offline', 'amber')}</td><td title="${esc(fFull.format(d.lastSeen))} AST">${esc(ago(d.lastSeen, now))}</td>
        <td>${f(d, 'ph', 2)}</td><td>${f(d, 'temperature', 1)}</td><td>${d.fresh.tds_ppm ? H.fmt(d.fresh.tds_ppm.value, 0) : '—'}</td><td>${d.fresh.turbidity_raw ? H.fmt(d.fresh.turbidity_raw.value, 0) : '—'}</td></tr>`).join('');
    const wf = (w, p, dg) => (w.fresh[p] ? (dg == null ? H.fmt(w.fresh[p].value, 0) : w.fresh[p].value.toFixed(dg)) : '—');
    const wellRows = (a.allWells || a.wells).map((w) => `<tr><td><b>${esc(w.label)}</b></td><td title="${esc(w.devices.join(', '))}">${w.devices.length}</td><td>${w.online ? tag('Online', 'green') : tag('Offline', 'amber')}</td>
        <td title="${esc(fFull.format(w.lastSeen))} AST">${esc(ago(w.lastSeen, now))}</td><td>${wf(w, 'ph', 2)}</td><td>${wf(w, 'temperature', 1)}</td><td>${wf(w, 'tds_ppm')}</td><td>${wf(w, 'turbidity_raw')}</td></tr>`).join('');
    return `<div class="panel-head"><div><div class="eyebrow">${H.icon('radio')} SENSOR NETWORK</div><h2>Connectivity &amp; alerts</h2></div>
        <div class="pills">${tag(`${c.wellsOnline}/${c.wellsTotal} wells online`, 'green')}${tag(`${c.devicesOffline} sensor${c.devicesOffline === 1 ? '' : 's'} offline`, c.devicesOffline ? 'amber' : 'grey')}</div></div>
      ${alerts.length ? `<ul class="alerts">${alerts.map((x) => `<li class="${x.severity}"><i></i><div><b>${esc(x.title)}</b><span>${esc(x.detail || '')}</span></div></li>`).join('')}${a.alerts.length > alerts.length ? `<li class="more">+${a.alerts.length - alerts.length} more</li>` : ''}</ul>`
        : `<div class="note ok">${H.icon('check')}<span>${c.devicesTotal ? 'No active sensor alerts.' : 'No devices to monitor yet.'}</span></div>`}
      <div class="tbl-wrap net-wrap"><table class="t net-table"><thead><tr><th>Well</th><th>Sensors</th><th>Status</th><th>Last reading</th><th>pH</th><th>°C</th><th>TDS ppm</th><th>Turb. raw</th></tr></thead>
        <tbody>${wellRows || '<tr><td colspan="8">No wells</td></tr>'}</tbody></table></div>
      <div class="tbl-wrap net-wrap"><table class="t net-table"><thead><tr><th>Sensor</th><th>Well</th><th>Status</th><th>Last reading</th><th>pH</th><th>°C</th><th>TDS ppm</th><th>Turb. raw</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">No devices</td></tr>'}</tbody></table></div>
      <div class="chart-foot"><span>Latest valid value per well and per sensor${st.cfg.operations.useLastKnownValues === false ? ` (window ${st.cfg.operations.freshnessMinutes} min)` : ` · offline after ${st.cfg.operations.freshnessMinutes} min`}</span><span>${esc(S.DISCLAIMER.split('.')[0])}</span></div>`;
  }

  /* ========================= page context for the assistant ========================= */
  function buildContext(page, title, section) {
    const a = st.view || st.network, conn = st.cfg ? connection() : { kind: 'idle', label: 'Not started' };
    const iso = (t) => (t == null ? null : new Date(t).toISOString());
    const ctx = {
      page, pageTitle: title, section, selectedDevice: st.device, dateRange: st.cfg ? st.rangeKey : null,
      dateRangeLabel: a ? a.range.label : null,
      status: st.configError ? 'not_configured' : st.loading ? 'loading' : st.db === 'error' ? 'database_error' : st.snapRows.length ? 'ok' : 'empty',
      error: st.configError || (st.error && st.error.message) || null,
      connection: { state: conn.kind, label: conn.label, realtime: st.realtime, lastUpdated: iso(st.lastUpdated) },
      timestamps: { generatedAt: new Date().toISOString(), lastDataUpdate: iso(st.lastUpdated), latestMeasurement: a ? iso(Math.max(0, ...S.PARAMS.map((p) => a.summary[p].latestAt || 0)) || null) : null },
      metrics: null, assessment: null, alerts: [], devices: [], charts: [], deviations: null,
    };
    if (a) {
      const as = a.assessment;
      ctx.metrics = a.metrics;
      ctx.assessment = { overall: as.overall, label: as.label, counts: as.counts, params: Object.fromEntries(Object.entries(as.params).map(([k, v]) => [k, { value: v.value, state: v.state, direction: v.direction || null, wells: v.count, devicesOutside: v.outsideDevices.length }])), attentionDevices: as.attentionDevices, disclaimer: as.disclaimer };
      ctx.alerts = a.alerts.slice(0, 20);
      ctx.wells = a.wells.map((w) => ({ well: w.label, well_id: w.well_id, devices: w.devices, online: w.online, lastSeen: iso(w.lastSeen), latest: Object.fromEntries(S.PARAMS.map((p) => [p, w.fresh[p] ? w.fresh[p].value : null])) }));
      ctx.devices = a.devices.map((d) => ({ device_id: d.device_id, well_id: d.well_id, online: d.online, lastSeen: iso(d.lastSeen), minutesAgo: Math.round(d.ageMs / 60000) }));
      ctx.deviations = a.deviations;
      ctx.charts = chartDefs().map((c) => {
        const pts = a.series[c.key].points, ds = pts.length > 48 ? Array.from({ length: 48 }, (_, i) => pts[Math.round((i * (pts.length - 1)) / 47)]) : pts;
        return { id: c.key, title: c.title, unit: c.key === 'turbidity_raw' ? 'raw (uncalibrated, not NTU)' : c.unit, bucketMinutes: a.range.bucketMs / 60000, pointCount: pts.length,
          min: pts.length ? Math.min(...pts.map((p) => p.min)) : null, max: pts.length ? Math.max(...pts.map((p) => p.max)) : null,
          change: S.seriesChange(pts), statistic: statName(c.key) + ' across wells', points: ds.map((p) => ({ t: iso(p.t), value: p.value, median: p.median, min: p.min, max: p.max, wells: p.n, devices: p.devices })) };
      });
    }
    return ctx;
  }

  /* ========================= mounting ========================= */
  function unmount() {
    if (disposer) { disposer(); disposer = null; }
    if (st.device) { st.device = null; if (st.cfg) recompute(); }
  }

  const rangeSelect = (id) => `<select class="select-sm" id="${id}" aria-label="Date range">${Object.entries(st.cfg ? st.cfg.ranges : { '24h': { label: 'Last 24 hours' } }).map(([k, r]) => `<option value="${k}"${k === st.rangeKey ? ' selected' : ''}>${esc(r.label)}</option>`).join('')}</select>`;

  function wireDeviceRows(root, onPick) {
    root.querySelectorAll('tr[data-device]').forEach((tr) => {
      const go = () => onPick(tr.dataset.device);
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  /** Dashboard: fills the sensor KPI cards in `view` and the LIVE SENSOR ANALYTICS section in `host`. */
  function mountDashboard(view, host) {
    unmount(); st.device = null; if (st.cfg) recompute();
    H.setContext(() => buildContext('dashboard', 'Groundwater Intelligence Summary', 'Overview'));
    const cfgReady = !!st.cfg;
    host.innerHTML = `<div class="section-label rise">LIVE SENSOR ANALYTICS <span class="info" title="Readings from the Supabase readings table. Latest reading per well, combined across wells (mean or median depending on the parameter). Refreshed every few seconds.">i</span>
        <span class="sec-right"><span id="sx-updated" class="muted"></span>${cfgReady ? rangeSelect('sx-range') : ''}</span></div>
      <div id="sx-banner"></div>
      <div class="charts4" id="sx-charts">${cfgReady ? chartCardsHTML() : ''}</div>
      <div class="row2"><section class="card panel" id="sx-assess"></section><section class="card panel" id="sx-net"></section></div>`;
    let animPending = true, chartsBuilt = cfgReady;
    const render = () => {
      const animate = animPending && !st.loading;   // entrance animation runs once, when real data first arrives
      if (animate) animPending = false;
      if (st.cfg && !chartsBuilt) { host.querySelector('#sx-charts').innerHTML = chartCardsHTML(); chartsBuilt = true; }
      if (st.cfg && !host.querySelector('#sx-range')) {
        host.querySelector('.sec-right').insertAdjacentHTML('beforeend', rangeSelect('sx-range'));
        host.querySelector('#sx-range').addEventListener('change', (e) => setRange(e.target.value));
      }
      fillKpis(view, animate);
      host.querySelector('#sx-banner').innerHTML = bannerHTML();
      const up = host.querySelector('#sx-updated'); if (up) up.textContent = st.lastUpdated ? `Updated ${fTime.format(st.lastUpdated)} AST` : '';
      const sel = host.querySelector('#sx-range'); if (sel && sel.value !== st.rangeKey) sel.value = st.rangeKey;
      if (st.cfg && st.network) fillCharts(host, st.network, animate);
      host.querySelector('#sx-assess').innerHTML = assessmentHTML(st.network);
      const net = host.querySelector('#sx-net'); net.innerHTML = networkHTML(st.network, false);
      wireDeviceRows(net, (id) => { location.hash = `#/quality?device=${encodeURIComponent(id)}`; });
    };
    const sel0 = host.querySelector('#sx-range'); if (sel0) sel0.addEventListener('change', (e) => setRange(e.target.value));
    render();
    const un = subscribe(render);
    disposer = () => { un(); };
  }

  /** Water Quality page (sensor part). */
  function mountQuality(host) {
    unmount();
    const q = (location.hash.split('?')[1] || '');
    let pending = new URLSearchParams(q).get('device');
    H.setContext(() => buildContext('quality', 'Water Quality', 'Monitoring & Measurement'));
    const cfgReady = !!st.cfg;
    host.innerHTML = `<div class="page-head"><div><h1>Water Quality</h1><p>Live groundwater sensor readings from Supabase and a preliminary, threshold-based assessment. Not a drinking-water certification.</p></div>
        <div class="toolbar"><label class="select-pill"><span class="muted">Device</span><select id="wq-device" aria-label="Device"><option value="">All devices (network)</option></select></label><span id="wq-range-host">${cfgReady ? rangeSelect('wq-range') : ''}</span></div></div>
      <div id="wq-banner"></div>
      <div class="charts4" id="wq-charts">${cfgReady ? chartCardsHTML() : ''}</div>
      <div class="row2"><section class="card panel" id="wq-assess"></section><section class="card panel" id="wq-net"></section></div>`;
    let first = true, built = cfgReady, optKey = '';
    if (pending && st.cfg) { st.device = pending; pending = null; recompute(); }
    const bindRange = () => { const r = host.querySelector('#wq-range'); if (r) r.addEventListener('change', (e) => setRange(e.target.value)); };
    bindRange();
    host.querySelector('#wq-device').addEventListener('change', (e) => setDevice(e.target.value));
    const render = () => {
      if (pending && st.cfg) { st.device = pending; pending = null; recompute(); }
      const animate = first && !st.loading; if (!st.loading) first = false;
      if (st.cfg && !built) { host.querySelector('#wq-charts').innerHTML = chartCardsHTML(); host.querySelector('#wq-range-host').innerHTML = rangeSelect('wq-range'); bindRange(); built = true; }
      const ids = st.network ? st.network.allDevices.map((d) => d.device_id) : [];
      if (st.device && !ids.includes(st.device)) ids.push(st.device);
      const key = ids.join('|');
      const dsel = host.querySelector('#wq-device');
      if (key !== optKey) { dsel.innerHTML = '<option value="">All devices (network)</option>' + ids.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join(''); optKey = key; }
      dsel.value = st.device || '';
      const rsel = host.querySelector('#wq-range'); if (rsel && rsel.value !== st.rangeKey) rsel.value = st.rangeKey;
      host.querySelector('#wq-banner').innerHTML = bannerHTML();
      if (st.cfg && st.view) fillCharts(host, st.view, animate);
      host.querySelector('#wq-assess').innerHTML = assessmentHTML(st.view);
      const net = host.querySelector('#wq-net'); net.innerHTML = networkHTML(st.network, true);
      wireDeviceRows(net, (id) => setDevice(st.device === id ? null : id));
    };
    render();
    const un = subscribe(render);
    disposer = () => { un(); };
  }

  function init(helpers) { H = helpers; }

  // For the farmer's "My farm" page: each sensor's latest values and its readings over the selected period
  function farmData() {
    return { ready: !!st.network, devices: st.network ? st.network.devices : [], history: st.histRows,
      snapshot: st.snapRows, cfg: st.cfg, lastUpdated: st.lastUpdated, range: st.network ? st.network.range : null };
  }

  window.SensorUI = { init, start, stop, unmount, mountDashboard, mountQuality, renderLive, connection, kpiInner, getContext: buildContext, farmData };
})();
