/*
 * AquaMaa sensor logic: pure functions, no I/O. Used by the browser (window.AquaMaaSensors)
 * and by the server (require). Everything here works on rows shaped like public.readings.
 *
 * Rules enforced here:
 *  - missing / invalid values are skipped, never treated as zero
 *  - each device contributes at most one value per parameter to a network summary
 *  - stale values (older than the freshness window) are excluded
 *  - the representative network value is the median of per-device latest values
 *  - turbidity is the device's turbidity index (not NTU); it is only judged when a limit is configured
 *  - turbidity_status and water_level_status are text from the device: the latest value is kept per device/well
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AquaMaaSensors = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELDS = ['ph', 'temperature', 'tds_ppm', 'turbidity_index'];
  const PARAMS = ['ph', 'temperature', 'tds_ppm', 'turbidity_index'];
  const STATUS_FIELDS = ['turbidity_status', 'water_level_status'];
  const ASSESSED = ['ph', 'temperature', 'tds_ppm'];
  const DISCLAIMER = 'Preliminary sensor-based monitoring indicator. It is not a drinking-water certification and does not show that water is safe or potable.';

  /* ---------- basics ---------- */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function validValue(field, raw, validity) {
    const n = num(raw);
    if (n === null) return null;
    const r = validity && validity[field];
    if (r) {
      if (r.min != null && n < r.min) return null;
      if (r.max != null && n > r.max) return null;
    }
    return n;
  }
  function median(values) {
    if (!values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function timeOf(row) {
    const t = Date.parse(row && row.created_at);
    return Number.isFinite(t) ? t : null;
  }
  /* pH is logarithmic: the chemically meaningful mean works on hydrogen-ion activity. */
  function phMeanByHydrogen(values) {
    if (!values.length) return null;
    const meanH = values.reduce((s, v) => s + Math.pow(10, -v), 0) / values.length;
    return -Math.log10(meanH);
  }
  function mean(values) {
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  }

  /*
   * How each parameter is combined, in two steps:
   *   withinWell  - several sensors in the SAME well measure the same water: average them
   *                 (pH on hydrogen-ion activity, since pH is logarithmic).
   *   acrossWells - different wells are different water bodies: summarise them.
   *     pH          median  (log scale; robust; a mean of different wells' pH has no chemical meaning)
   *     temperature mean    (linear, narrow, symmetric spread)
   *     TDS         median  (salinity is skewed; one very saline well should not drag the headline)
   *     turbidity   median  (raw, uncalibrated, spiky)
   * Overridable per parameter in config/thresholds.json -> "aggregation".
   */
  const DEFAULT_AGGREGATION = {
    ph: { withinWell: 'hydrogenMean', acrossWells: 'median' },
    temperature: { withinWell: 'mean', acrossWells: 'mean' },
    tds_ppm: { withinWell: 'mean', acrossWells: 'median' },
    turbidity_index: { withinWell: 'median', acrossWells: 'median' },
  };
  const AGG_LABEL = { mean: 'mean', median: 'median', hydrogenMean: '[H⁺]-based mean' };
  function aggregationFor(field, cfgAgg) {
    return Object.assign({ withinWell: 'median', acrossWells: 'median' }, DEFAULT_AGGREGATION[field], cfgAgg && cfgAgg[field]);
  }
  function combine(method, values) {
    if (!values.length) return null;
    if (method === 'mean') return mean(values);
    if (method === 'hydrogenMean') return phMeanByHydrogen(values);
    return median(values);
  }
  /* Rows without a well_id (e.g. before the column existed) count as their own well. */
  function wellKeyOf(wellId, deviceId) { return wellId != null ? `w:${wellId}` : `d:${deviceId}`; }

  function classifyPh(value, phCfg) {
    if (value == null) return null;
    const band = (phCfg && phCfg.neutralBand) || { min: 6.5, max: 7.5 };
    if (value < band.min) return 'Acidic';
    if (value > band.max) return 'Alkaline';
    return 'Neutral';
  }

  /* ---------- latest valid reading per device ---------- */
  function latestPerDevice(rows, opts) {
    const { now, freshnessMs, lookbackMs, validity, useLastKnown } = opts;
    const devs = new Map();
    for (const r of rows || []) {
      if (!r || typeof r.device_id !== 'string' || !r.device_id) continue;
      const t = timeOf(r);
      if (t === null) continue;
      if (lookbackMs && now - t > lookbackMs) continue;
      let d = devs.get(r.device_id);
      if (!d) { d = { device_id: r.device_id, lastSeen: t, latest: {}, status: {}, well_id: null, wellAt: -Infinity }; devs.set(r.device_id, d); }
      if (t > d.lastSeen) d.lastSeen = t;
      const w = num(r.well_id);
      if (w !== null && t >= d.wellAt) { d.well_id = w; d.wellAt = t; }   // the device's current well
      for (const f of FIELDS) {
        const v = validValue(f, r[f], validity);
        if (v === null) continue;
        const cur = d.latest[f];
        if (!cur || t > cur.at) d.latest[f] = { value: v, at: t };
      }
      for (const f of STATUS_FIELDS) {
        const v = typeof r[f] === 'string' ? r[f].trim() : '';
        if (!v) continue;
        const cur = d.status[f];
        if (!cur || t > cur.at) d.status[f] = { value: v, at: t };
      }
    }
    return Array.from(devs.values()).map((d) => {
      const fresh = {};
      // useLastKnown: every device's latest valid value is used however old it is; the freshness
      // window then only decides online/offline, and old values are flagged `stale`.
      for (const f of FIELDS) {
        const l = d.latest[f], old = l && now - l.at > freshnessMs;
        fresh[f] = l && (useLastKnown || !old) ? { ...l, stale: !!old } : null;
      }
      const ageMs = now - d.lastSeen;
      const status = {};
      for (const f of STATUS_FIELDS) { const l = d.status[f]; status[f] = l ? { ...l, stale: now - l.at > freshnessMs } : null; }
      return { device_id: d.device_id, well_id: d.well_id, wellKey: wellKeyOf(d.well_id, d.device_id), lastSeen: d.lastSeen, ageMs, online: ageMs <= freshnessMs, latest: d.latest, fresh, status };
    }).sort((a, b) => (a.device_id < b.device_id ? -1 : 1));
  }

  /* ---------- latest value per well: combine the fresh values of the well's devices ---------- */
  function latestPerWell(devices, cfgAgg) {
    const wells = new Map();
    for (const d of devices) {
      const k = d.wellKey || wellKeyOf(d.well_id, d.device_id);
      let w = wells.get(k);
      if (!w) { w = { key: k, well_id: d.well_id != null ? d.well_id : null, label: d.well_id != null ? `Well ${d.well_id}` : d.device_id, devices: [], lastSeen: d.lastSeen, online: false, fresh: {}, status: {} }; wells.set(k, w); }
      w.devices.push(d.device_id);
      if (d.lastSeen > w.lastSeen) w.lastSeen = d.lastSeen;
      if (d.online) w.online = true;
      for (const f of STATUS_FIELDS) {
        const x = d.status && d.status[f];
        if (x && (!w.status[f] || x.at > w.status[f].at)) w.status[f] = x;
      }
    }
    for (const w of wells.values()) {
      const members = devices.filter((d) => (d.wellKey || wellKeyOf(d.well_id, d.device_id)) === w.key);
      for (const f of FIELDS) {
        const pts = members.filter((d) => d.fresh[f]).map((d) => d.fresh[f]);
        w.fresh[f] = pts.length ? { value: combine(aggregationFor(f, cfgAgg).withinWell, pts.map((p) => p.value)), at: Math.max(...pts.map((p) => p.at)), n: pts.length, stale: pts.every((p) => p.stale) } : null;
      }
    }
    return Array.from(wells.values()).sort((a, b) =>
      (a.well_id == null) - (b.well_id == null) || (a.well_id - b.well_id) || (a.label < b.label ? -1 : 1));
  }

  /* ---------- network summary: latest value per well, then combined across wells ---------- */
  function summarize(devices, cfgAgg) {
    const wells = latestPerWell(devices, cfgAgg);
    const out = {};
    for (const f of FIELDS) {
      const agg = aggregationFor(f, cfgAgg);
      const pts = wells.filter((w) => w.fresh[f]).map((w) => ({ well: w.label, value: w.fresh[f].value, at: w.fresh[f].at, stale: w.fresh[f].stale }));
      const devPts = devices.filter((d) => d.fresh[f]).map((d) => ({ device_id: d.device_id, value: d.fresh[f].value }));
      if (!pts.length) {
        out[f] = { count: 0, devices: 0, value: null, statistic: agg.acrossWells, median: null, mean: null, min: null, max: null, latestAt: null, minWell: null, maxWell: null, minDevice: null, maxDevice: null };
        continue;
      }
      const vals = pts.map((p) => p.value);
      const lo = pts.reduce((a, p) => (p.value < a.value ? p : a));
      const hi = pts.reduce((a, p) => (p.value > a.value ? p : a));
      const dlo = devPts.reduce((a, p) => (p.value < a.value ? p : a));
      const dhi = devPts.reduce((a, p) => (p.value > a.value ? p : a));
      out[f] = {
        count: pts.length, devices: devPts.length, value: combine(agg.acrossWells, vals), statistic: agg.acrossWells,
        median: median(vals), mean: mean(vals), min: lo.value, max: hi.value,
        latestAt: Math.max(...pts.map((p) => p.at)), staleWells: pts.filter((p) => p.stale).length, minWell: lo.well, maxWell: hi.well, minDevice: dlo.device_id, maxDevice: dhi.device_id,
      };
    }
    // Hydrogen-ion based mean of the well values, offered alongside the headline pH.
    out.ph.meanByHydrogen = phMeanByHydrogen(wells.filter((w) => w.fresh.ph).map((w) => w.fresh.ph.value));
    return out;
  }

  /* ---------- thresholds ---------- */
  function outOfRange(range, v) {
    if (!range) return null;
    if (range.min != null && v < range.min) return 'below';
    if (range.max != null && v > range.max) return 'above';
    return null;
  }
  function evalThreshold(value, p) {
    if (value == null) return { state: 'no_data' };
    if (!p || (!p.reference && !p.critical)) return { state: 'not_assessed' };
    const c = outOfRange(p.critical, value);
    if (c) return { state: 'critical', direction: c };
    const r = outOfRange(p.reference, value);
    if (r) return { state: 'outside', direction: r };
    return { state: 'within' };
  }
  function isConfigured(p) { return !!(p && (p.reference || p.critical)); }

  /* ---------- assessment ---------- */
  function assess(summary, devices, cfgParams, opts) {
    const minParams = (opts && opts.minAssessableParameters) || 1;
    const params = {};
    for (const p of ASSESSED) {
      const s = summary[p];
      const e = evalThreshold(s.median, cfgParams[p]);
      const outsideDevices = [];
      for (const d of devices) {
        if (!d.fresh[p]) continue;
        const de = evalThreshold(d.fresh[p].value, cfgParams[p]);
        if (de.state === 'outside' || de.state === 'critical') outsideDevices.push({ device_id: d.device_id, value: d.fresh[p].value, state: de.state, direction: de.direction });
      }
      params[p] = { value: s.value, statistic: s.statistic, wells: s.count, min: s.min, max: s.max, count: s.count, ...e, outsideDevices };
    }
    const tb = summary.turbidity_index;   // judged only if a limit is configured (none today): shown, not assessed
    params.turbidity_index = { value: tb.value, statistic: tb.statistic, wells: tb.count, min: tb.min, max: tb.max, count: tb.count, ...evalThreshold(tb.value, cfgParams.turbidity_index), outsideDevices: [] };

    const assessable = ASSESSED.filter((p) => isConfigured(cfgParams[p]));
    const withData = assessable.filter((p) => summary[p].count > 0);
    const outsideParams = withData.filter((p) => params[p].outsideDevices.length > 0 || params[p].state === 'outside' || params[p].state === 'critical');
    const critical = withData.some((p) => params[p].state === 'critical' || params[p].outsideDevices.some((o) => o.state === 'critical'));

    let overall;
    if (withData.length < minParams) overall = 'insufficient_data';
    else if (critical) overall = 'critical';
    else if (outsideParams.length) overall = 'attention';
    else overall = 'normal';

    const attentionDevices = [];
    for (const d of devices) {
      const issues = [];
      for (const p of ASSESSED) {
        const o = params[p].outsideDevices.find((x) => x.device_id === d.device_id);
        if (o) issues.push({ param: p, value: o.value, state: o.state, direction: o.direction });
      }
      if (issues.length) attentionDevices.push({ device_id: d.device_id, issues });
    }
    const offline = devices.filter((d) => !d.online);
    const paramsWithData = PARAMS.filter((p) => summary[p].count > 0).length;

    return {
      overall,
      label: { normal: 'Normal', attention: 'Attention Required', critical: 'Critical', insufficient_data: 'Insufficient Data' }[overall],
      params,
      counts: {
        parametersTotal: PARAMS.length,
        parametersWithData: paramsWithData,
        parametersAssessed: withData.length,
        parametersOutside: outsideParams.length,
        devicesTotal: devices.length,
        devicesOnline: devices.length - offline.length,
        devicesOffline: offline.length,
        devicesAttention: attentionDevices.length,
      },
      attentionDevices,
      offlineDevices: offline.map((d) => ({ device_id: d.device_id, lastSeen: d.lastSeen, ageMs: d.ageMs })),
      disclaimer: DISCLAIMER,
    };
  }

  /* ---------- time series: median per device per bucket -> per well -> across wells ---------- */
  function bucketSeries(rows, field, opts) {
    const { start, end, bucketMs, device, validity, aggregation } = opts;
    const agg = aggregationFor(field, aggregation);
    const buckets = new Map();
    for (const r of rows || []) {
      if (!r || typeof r.device_id !== 'string') continue;
      if (device && r.device_id !== device) continue;
      const t = timeOf(r);
      if (t === null || t < start || t > end) continue;
      const v = validValue(field, r[field], validity);
      if (v === null) continue;
      const b = Math.floor(t / bucketMs) * bucketMs;
      let perDev = buckets.get(b);
      if (!perDev) { perDev = new Map(); buckets.set(b, perDev); }
      const dk = r.device_id + '\u0000' + wellKeyOf(num(r.well_id), r.device_id);
      const arr = perDev.get(dk);
      if (arr) arr.vals.push(v); else perDev.set(dk, { well: wellKeyOf(num(r.well_id), r.device_id), vals: [v] });
    }
    const points = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([t, perDev]) => {
      const perWell = new Map();
      for (const { well, vals } of perDev.values()) {
        const m = median(vals);
        const a = perWell.get(well); if (a) a.push(m); else perWell.set(well, [m]);
      }
      const wv = Array.from(perWell.values()).map((ms) => combine(agg.withinWell, ms));
      return { t, value: combine(agg.acrossWells, wv), median: median(wv), min: Math.min(...wv), max: Math.max(...wv), n: wv.length, devices: perDev.size };
    });
    return { field, start, end, bucketMs, points };
  }

  function seriesChange(points) {
    if (!points || points.length < 2) return null;
    const a = points[0], b = points[points.length - 1];
    return { from: a.value, to: b.value, delta: b.value - a.value, fromAt: a.t, toAt: b.t };
  }
  function outsideShare(points, p) {
    if (!points || !points.length || !isConfigured(p)) return null;
    const bad = points.filter((pt) => { const e = evalThreshold(pt.value, p); return e.state === 'outside' || e.state === 'critical'; }).length;
    return { buckets: points.length, outside: bad, share: bad / points.length };
  }

  /* ---------- deviation from history (modified z-score, Iglewicz & Hoaglin) ---------- */
  function deviationCheck(points, current, cfg) {
    const minPts = (cfg && cfg.minBaselinePoints) || 12;
    const zMax = (cfg && cfg.zThreshold) || 3.5;
    if (current == null) return { evaluated: false, reason: 'No current value' };
    const base = (points || []).slice(0, -1).map((p) => p.value).filter((v) => v != null);
    if (base.length < minPts) return { evaluated: false, reason: `Needs at least ${minPts} earlier time buckets (have ${base.length})` };
    const med = median(base);
    const mad = median(base.map((v) => Math.abs(v - med)));
    let scale = mad * 1.4826;
    if (!scale) {
      const meanAd = base.reduce((s, v) => s + Math.abs(v - med), 0) / base.length;
      scale = meanAd * 1.2533;
    }
    if (!scale) return { evaluated: false, reason: 'Earlier readings show no variation' };
    const z = (current - med) / scale;
    return { evaluated: true, flag: Math.abs(z) > zMax, z, baselineMedian: med, direction: z > 0 ? 'above' : 'below', zThreshold: zMax };
  }

  /* ---------- alerts ---------- */
  function buildAlerts(assessment, deviations, opts) {
    const alerts = [];
    const P = (opts && opts.labels) || {};
    const lab = (p) => P[p] || p;
    for (const d of assessment.attentionDevices) {
      for (const i of d.issues) {
        alerts.push({
          id: `thr:${d.device_id}:${i.param}`, severity: i.state === 'critical' ? 'critical' : 'warning', type: 'threshold', device_id: d.device_id, param: i.param,
          title: `${lab(i.param)} ${i.direction} reference range`, detail: `${d.device_id}: ${i.value}`,
        });
      }
    }
    for (const o of assessment.offlineDevices) {
      alerts.push({ id: `off:${o.device_id}`, severity: 'warning', type: 'offline', device_id: o.device_id, title: 'No recent readings', detail: `${o.device_id} last reported ${Math.round(o.ageMs / 60000)} min ago`, lastSeen: o.lastSeen });
    }
    for (const [p, dv] of Object.entries(deviations || {})) {
      if (dv && dv.evaluated && dv.flag) {
        alerts.push({ id: `dev:${p}`, severity: 'warning', type: 'deviation', param: p, title: `${lab(p)} deviates from recent history`, detail: `Modified z-score ${dv.z.toFixed(1)} (${dv.direction} the earlier median ${dv.baselineMedian.toFixed(1)})` });
      }
    }
    const rank = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  /* ---------- structured metrics for the dashboard context / assistant ---------- */
  function buildMetrics(summary, assessment, cfg) {
    const pc = cfg.parameters;
    const st = (p) => assessment.params[p].state;
    const ref = (p) => (pc[p] && pc[p].reference) || null;
    const statOf = (p) => `${AGG_LABEL[summary[p].statistic] || summary[p].statistic} across wells of each well's latest reading`;
    return {
      ph: { value: summary.ph.value, unit: 'pH', statistic: `${statOf('ph')} (not a mixed-water pH)`, classification: classifyPh(summary.ph.value, pc.ph),
        min: summary.ph.min, max: summary.ph.max, wells: summary.ph.count, devices: summary.ph.devices, status: st('ph'), reference: ref('ph'), hydrogenIonMean: summary.ph.meanByHydrogen, latestAt: summary.ph.latestAt },
      temperature: { value: summary.temperature.value, unit: 'C', statistic: statOf('temperature'), min: summary.temperature.min, max: summary.temperature.max, wells: summary.temperature.count, devices: summary.temperature.devices, status: st('temperature'), reference: ref('temperature'), latestAt: summary.temperature.latestAt },
      tds: { value: summary.tds_ppm.value, unit: 'ppm', statistic: statOf('tds_ppm'), min: summary.tds_ppm.min, max: summary.tds_ppm.max, wells: summary.tds_ppm.count, devices: summary.tds_ppm.devices, status: st('tds_ppm'), reference: ref('tds_ppm'), highestWell: summary.tds_ppm.maxWell, highestDevice: summary.tds_ppm.maxDevice, latestAt: summary.tds_ppm.latestAt },
      turbidity: { value: summary.turbidity_index.value, unit: 'index (device scale, not NTU)', statistic: statOf('turbidity_index'), min: summary.turbidity_index.min, max: summary.turbidity_index.max, wells: summary.turbidity_index.count, devices: summary.turbidity_index.devices, status: st('turbidity_index'), latestAt: summary.turbidity_index.latestAt },
    };
  }

  /* ---------- CCME Water Quality Index (CCME 2001, Canadian Water Quality Guidelines) ----------
   *   F1 scope     = % of variables that failed their objective at least once
   *   F2 frequency = % of individual tests that failed
   *   F3 amplitude = nse / (0.01·nse + 0.01), nse = Σ excursions / all tests,
   *                  excursion = value/max − 1 (above a maximum) or min/value − 1 (below a minimum)
   *   WQI = 100 − √(F1² + F2² + F3²) / 1.732
   * Objectives are the configured reference ranges. A "test" is one well value per time bucket
   * (the median of each sensor in the bucket, combined within the well), so a sensor that
   * reports every few seconds does not count as thousands of samples.
   * Computed per well; the headline is the lowest-scoring well. */
  const WQI_BANDS = [[95, 'Excellent'], [80, 'Good'], [65, 'Fair'], [45, 'Marginal'], [0, 'Poor']];
  function wqiCategory(v) { for (const [lo, name] of WQI_BANDS) if (v >= lo) return name; return 'Poor'; }

  function wellSamples(rows, field, opts) {
    const { start, end, bucketMs, device, validity, aggregation } = opts;
    const agg = aggregationFor(field, aggregation);
    const perWell = new Map();   // wellKey -> { label, buckets: Map(bucket -> Map(device -> values[])) }
    for (const r of rows || []) {
      if (!r || typeof r.device_id !== 'string') continue;
      if (device && r.device_id !== device) continue;
      const t = timeOf(r);
      if (t === null || t < start || t > end) continue;
      const v = validValue(field, r[field], validity);
      if (v === null) continue;
      const wk = wellKeyOf(num(r.well_id), r.device_id), b = Math.floor(t / bucketMs) * bucketMs;
      if (!perWell.has(wk)) perWell.set(wk, { label: num(r.well_id) != null ? `Well ${num(r.well_id)}` : r.device_id, buckets: new Map() });
      const bk = perWell.get(wk).buckets;
      if (!bk.has(b)) bk.set(b, new Map());
      const dv = bk.get(b);
      if (dv.has(r.device_id)) dv.get(r.device_id).push(v); else dv.set(r.device_id, [v]);
    }
    const out = new Map();
    for (const [wk, w] of perWell) {
      out.set(wk, { label: w.label, values: Array.from(w.buckets.values()).map((dv) => combine(agg.withinWell, Array.from(dv.values()).map(median))) });
    }
    return out;
  }

  function ccmeIndex(testsByVar) {
    const vars = Object.keys(testsByVar).filter((p) => testsByVar[p].length);
    if (!vars.length) return null;
    let total = 0, failed = 0, excSum = 0; const failedVars = [];
    for (const p of vars) {
      let anyFail = false;
      for (const { value, objective: o } of testsByVar[p]) {
        total++;
        let exc = 0;
        if (o.max != null && value > o.max) exc = value / o.max - 1;
        else if (o.min != null && value < o.min) exc = value > 0 ? o.min / value - 1 : 1;
        if (exc > 0) { failed++; excSum += exc; anyFail = true; }
      }
      if (anyFail) failedVars.push(p);
    }
    const F1 = (100 * failedVars.length) / vars.length;
    const F2 = (100 * failed) / total;
    const nse = excSum / total;
    const F3 = nse / (0.01 * nse + 0.01);
    const wqi = Math.max(0, Math.min(100, 100 - Math.sqrt(F1 * F1 + F2 * F2 + F3 * F3) / 1.732));
    return { wqi, category: wqiCategory(wqi), F1, F2, F3, variables: vars, failedVariables: failedVars, tests: total, failedTests: failed };
  }

  function ccmeWqi(rows, cfg, opts) {
    const wcfg = cfg.wqi || {};
    const minSamples = wcfg.minSamplesPerVariable || 4;
    const params = (wcfg.parameters || ASSESSED).filter((p) => cfg.parameters[p]);
    const used = params.filter((p) => cfg.parameters[p].reference);
    const excluded = PARAMS.filter((p) => !used.includes(p)).map((p) => ({
      param: p, reason: 'no acceptable limit configured' }));
    const byWell = new Map();
    for (const p of used) {
      for (const [wk, w] of wellSamples(rows, p, { ...opts, aggregation: cfg.aggregation, validity: cfg.validity })) {
        if (!byWell.has(wk)) byWell.set(wk, { label: w.label, tests: {} });
        byWell.get(wk).tests[p] = w.values.map((value) => ({ value, objective: cfg.parameters[p].reference }));
      }
    }
    const wells = [];
    for (const w of byWell.values()) {
      const r = ccmeIndex(w.tests);
      if (!r) continue;
      const samples = Math.min(...r.variables.map((p) => w.tests[p].length));
      wells.push({ well: w.label, ...r, samplesPerVariable: samples, sufficient: samples >= minSamples && r.variables.length === used.length });
    }
    wells.sort((a, b) => a.wqi - b.wqi);
    return {
      method: 'CCME WQI (2001)', objectives: Object.fromEntries(used.map((p) => [p, cfg.parameters[p].reference])),
      parameters: used, excluded, minSamplesPerVariable: minSamples, wells, headline: wells[0] || null,
    };
  }

  /* ---------- Water Card: what each well's water is good for (config "waterUse") ----------
   * Crops: suitable when the well's latest TDS is at or below the crop's no-yield-loss salinity
   * (FAO 29 Table 4, ECw x 640). Drinking: taste only (WHO), plus pH 6.5-8.5; never "safe". */
  function waterCard(wells, cfg) {
    const wu = cfg.waterUse;
    if (!wu) return [];
    const k = wu.tdsPerEcw || 640;
    return wells.map((w) => {
      const tds = w.fresh.tds_ppm ? w.fresh.tds_ppm.value : null;
      const ph = w.fresh.ph ? w.fresh.ph.value : null;
      if (tds == null) return { well: w.label, well_id: w.well_id, tds: null, uses: [], stale: false };
      const uses = [];
      const d = wu.drinking;
      if (d) {
        const phBad = ph != null && d.ph && ((d.ph.min != null && ph < d.ph.min) || (d.ph.max != null && ph > d.ph.max));
        const level = tds > d.tdsMax || phBad ? 'no' : tds > d.tdsGood ? 'limited' : 'ok';
        uses.push({ id: 'drinking', label: d.label, label_ar: d.label_ar, kind: 'drinking', ok: level !== 'no', level, limit: d.tdsMax,
          short: tds > d.tdsMax ? 'drinking (too salty)' : phBad ? `drinking (pH ${ph.toFixed(1)})` : 'drinking',
          reason: tds > d.tdsMax ? `TDS ${Math.round(tds)} above ${d.tdsMax} (too salty to drink)` : phBad ? `pH ${ph.toFixed(1)} outside ${d.ph.min}-${d.ph.max}` : level === 'limited' ? 'acceptable taste, becoming salty' : 'good taste',
          note: d.note });
      }
      for (const c of wu.crops || []) {
        const limit = Math.round(c.ecwNoLoss * k);
        uses.push({ id: c.crop, label: c.label, label_ar: c.label_ar, short: c.label.toLowerCase(), kind: 'crop', ok: tds <= limit, level: tds <= limit ? 'ok' : 'no', limit,
          reason: tds <= limit ? `TDS within ${limit} (full yield)` : `TDS ${Math.round(tds)} above ${limit} (yield loss)` });
      }
      return { well: w.label, well_id: w.well_id, tds, ph, stale: !!w.fresh.tds_ppm.stale, at: w.fresh.tds_ppm.at, uses };
    });
  }
  const lcFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);   // 'Total dissolved solids' -> 'total…', 'pH' stays
  const listText = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

  /* Alerts from the Water Card and the WQI. Titles are full sentences: Pepper speaks them as they are. */
  function extraAlerts(card, wqi, cfg, wells) {
    const out = [];
    // Device status text (config "statusAlerts"): an alert when a well's latest status is one of
    // alertOn, or (with normal) anything other than the normal values. Titles are spoken by Pepper.
    const sa = cfg.statusAlerts || {};
    for (const w of wells || []) {
      for (const [f, rule] of Object.entries(sa)) {
        if (f.startsWith('_') || !w.status || !w.status[f]) continue;
        const v = w.status[f].value, V = v.toUpperCase();
        const bad = rule.alertOn ? rule.alertOn.map((x) => x.toUpperCase()).includes(V)
          : rule.normal ? !rule.normal.map((x) => x.toUpperCase()).includes(V) : false;
        if (!bad) continue;
        const msg = (rule.messages && (rule.messages[V] || rule.messages['*'])) || '';
        out.push({
          id: `status:${w.label}:${f}:${V}`, severity: (rule.critical || []).map((x) => x.toUpperCase()).includes(V) ? 'critical' : 'warning',
          type: 'status', well: w.label, param: f,
          title: `${w.label}: the ${rule.label.toLowerCase()} sensor reports "${v}".${msg ? ` ${msg}` : ''}`,
          detail: `${rule.label}: ${v}${w.status[f].stale ? ' (last known value)' : ''}`,
        });
      }
    }
    for (const w of card) {
      const lost = w.uses.filter((u) => !u.ok), kept = w.uses.filter((u) => u.ok && u.kind === 'crop');
      if (!lost.length) continue;
      const tdsTxt = `${Math.round(w.tds).toLocaleString('en-US')} ppm`;
      out.push({
        id: `use:${w.well}:${lost.map((u) => u.id).join('|')}`, severity: kept.length ? 'warning' : 'critical', type: 'water_use', well: w.well,
        title: `${w.well} water, at ${tdsTxt}, is not suitable for ${listText(lost.map((u) => u.short))}.` +
          (kept.length ? ` It is still suitable for ${listText(kept.map((u) => u.short))}.` : ' It is not suitable for any listed crop: mix it with fresher water or rest the well.'),
        detail: lost.map((u) => `${u.label}: ${u.reason}`).join('; ') + (w.stale ? ' (last known value)' : ''),
      });
    }
    const cats = (cfg.wqi && cfg.wqi.alertCategories) || ['Marginal', 'Poor'];
    for (const x of (wqi && wqi.wells) || []) {
      if (!cats.includes(x.category)) continue;
      const failed = x.failedVariables.map((p) => (cfg.parameters[p] ? cfg.parameters[p].label : p));
      out.push({
        id: `wqi:${x.well}:${x.category}`, severity: x.category === 'Poor' ? 'critical' : 'warning', type: 'wqi', well: x.well,
        title: `The water quality index of ${x.well} is ${Math.round(x.wqi)} out of 100, ${x.category.toLowerCase()}, because of ${listText(failed.map(lcFirst))}.`,
        detail: `CCME WQI ${wqi.period}: ${x.failedTests} of ${x.tests} tests outside the limits`,
      });
    }
    return out;
  }

  /* ---------- convenience: everything derived from rows, in one call ---------- */
  function analyze(snapshotRows, historyRows, cfg, now, rangeKey, device) {
    const ops = cfg.operations;
    const devices = latestPerDevice(snapshotRows, { now, freshnessMs: ops.freshnessMinutes * 60000, lookbackMs: ops.deviceLookbackHours * 3600000, validity: cfg.validity, useLastKnown: ops.useLastKnownValues !== false });
    const scoped = device ? devices.filter((d) => d.device_id === device) : devices;
    const summary = summarize(scoped, cfg.aggregation);
    const wells = latestPerWell(scoped, cfg.aggregation);
    const allWells = device ? latestPerWell(devices, cfg.aggregation) : wells;
    const assessment = assess(summary, scoped, cfg.parameters, ops);
    assessment.counts.wellsTotal = wells.length;
    assessment.counts.wellsOnline = wells.filter((w) => w.online).length;
    const range = cfg.ranges[rangeKey] || cfg.ranges[cfg.defaultRange];
    const series = {};
    for (const f of PARAMS) series[f] = bucketSeries(historyRows, f, { start: now - range.ms, end: now, bucketMs: range.bucketMs, device, validity: cfg.validity, aggregation: cfg.aggregation });
    const deviations = {};
    for (const p of (cfg.deviation && cfg.deviation.parameters) || []) deviations[p] = deviationCheck(series[p].points, summary[p].value, cfg.deviation);
    const labels = {}; for (const p of PARAMS) labels[p] = cfg.parameters[p].label;
    const alerts = buildAlerts(assessment, deviations, { labels });
    // WQI over the selected period; when the period has no readings (sensor offline), over the
    // last-known snapshot window instead, and say so.
    const wqiOpts = { start: now - range.ms, end: now, bucketMs: range.bucketMs, device };
    let wqi = ccmeWqi(historyRows, cfg, wqiOpts), wqiPeriod = range.label;
    if (!wqi.headline) {
      wqi = ccmeWqi(snapshotRows, cfg, { ...wqiOpts, start: now - ops.deviceLookbackHours * 3600000 });
      wqiPeriod = `last ${Math.round(ops.deviceLookbackHours / 24)} days (no readings in ${range.label.toLowerCase()})`;
    }
    wqi.period = wqiPeriod;
    const card = waterCard(wells, cfg);
    const rank = { critical: 0, warning: 1, info: 2 };
    alerts.push(...extraAlerts(card, wqi, cfg, wells));
    alerts.sort((x, y) => rank[x.severity] - rank[y.severity]);
    const metrics = buildMetrics(summary, assessment, cfg);
    metrics.deviceStatus = wells.map((w) => ({ well: w.label, ...Object.fromEntries(STATUS_FIELDS.map((f) => [f, w.status && w.status[f] ? w.status[f].value : null])) }));
    metrics.waterUse = card.map((w) => ({ well: w.well, tds: w.tds, lastKnown: w.stale, suitable: w.uses.filter((u) => u.ok).map((u) => u.id), notSuitable: w.uses.filter((u) => !u.ok).map((u) => u.id) }));
    metrics.wqi = wqi.headline ? { value: Math.round(wqi.headline.wqi), category: wqi.headline.category, well: wqi.headline.well, method: wqi.method,
      period: wqi.period, parameters: wqi.parameters, excluded: wqi.excluded.map((e) => e.param), F1: wqi.headline.F1, F2: wqi.headline.F2, F3: wqi.headline.F3,
      tests: wqi.headline.tests, failedTests: wqi.headline.failedTests, sufficient: wqi.headline.sufficient } : null;
    return { now, devices: scoped, allDevices: devices, wells, allWells, summary, assessment, series, deviations, alerts, wqi, waterCard: card, metrics, range: { key: rangeKey, ...range } };
  }

  return { FIELDS, PARAMS, STATUS_FIELDS, ASSESSED, DISCLAIMER, AGG_LABEL, num, median, mean, combine, aggregationFor, validValue, phMeanByHydrogen, classifyPh, latestPerDevice, latestPerWell, summarize, evalThreshold, assess, bucketSeries, seriesChange, outsideShare, deviationCheck, buildAlerts, buildMetrics, ccmeIndex, ccmeWqi, wqiCategory, waterCard, extraAlerts, analyze };
});
