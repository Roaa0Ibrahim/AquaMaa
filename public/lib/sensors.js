/*
 * AquaMaa sensor logic: pure functions, no I/O. Used by the browser (window.AquaMaaSensors)
 * and by the server (require). Everything here works on rows shaped like public.readings.
 *
 * Rules enforced here:
 *  - missing / invalid values are skipped, never treated as zero
 *  - each device contributes at most one value per parameter to a network summary
 *  - stale values (older than the freshness window) are excluded
 *  - the representative network value is the median of per-device latest values
 *  - turbidity is never converted to NTU and never enters the assessment
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AquaMaaSensors = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELDS = ['ph', 'temperature', 'tds_ppm', 'turbidity_raw', 'turbidity_voltage', 'ph_raw', 'ph_voltage'];
  const PARAMS = ['ph', 'temperature', 'tds_ppm', 'turbidity_raw'];
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
  function classifyPh(value, phCfg) {
    if (value == null) return null;
    const band = (phCfg && phCfg.neutralBand) || { min: 6.5, max: 7.5 };
    if (value < band.min) return 'Acidic';
    if (value > band.max) return 'Alkaline';
    return 'Neutral';
  }

  /* ---------- latest valid reading per device ---------- */
  function latestPerDevice(rows, opts) {
    const { now, freshnessMs, lookbackMs, validity } = opts;
    const devs = new Map();
    for (const r of rows || []) {
      if (!r || typeof r.device_id !== 'string' || !r.device_id) continue;
      const t = timeOf(r);
      if (t === null) continue;
      if (lookbackMs && now - t > lookbackMs) continue;
      let d = devs.get(r.device_id);
      if (!d) { d = { device_id: r.device_id, lastSeen: t, latest: {} }; devs.set(r.device_id, d); }
      if (t > d.lastSeen) d.lastSeen = t;
      for (const f of FIELDS) {
        const v = validValue(f, r[f], validity);
        if (v === null) continue;
        const cur = d.latest[f];
        if (!cur || t > cur.at) d.latest[f] = { value: v, at: t };
      }
    }
    return Array.from(devs.values()).map((d) => {
      const fresh = {};
      for (const f of FIELDS) fresh[f] = d.latest[f] && now - d.latest[f].at <= freshnessMs ? d.latest[f] : null;
      const ageMs = now - d.lastSeen;
      return { device_id: d.device_id, lastSeen: d.lastSeen, ageMs, online: ageMs <= freshnessMs, latest: d.latest, fresh };
    }).sort((a, b) => (a.device_id < b.device_id ? -1 : 1));
  }

  /* ---------- network summary: one value per device, median across devices ---------- */
  function summarize(devices) {
    const out = {};
    for (const f of FIELDS) {
      const pts = devices.filter((d) => d.fresh[f]).map((d) => ({ device_id: d.device_id, value: d.fresh[f].value, at: d.fresh[f].at }));
      if (!pts.length) {
        out[f] = { count: 0, median: null, min: null, max: null, latestAt: null, minDevice: null, maxDevice: null };
        continue;
      }
      const vals = pts.map((p) => p.value);
      const lo = pts.reduce((a, p) => (p.value < a.value ? p : a));
      const hi = pts.reduce((a, p) => (p.value > a.value ? p : a));
      out[f] = {
        count: pts.length, median: median(vals), min: lo.value, max: hi.value,
        latestAt: Math.max(...pts.map((p) => p.at)), minDevice: lo.device_id, maxDevice: hi.device_id,
      };
    }
    // Hydrogen-ion based mean, offered alongside the median pH (which is NOT a mixed-water pH).
    const phVals = devices.filter((d) => d.fresh.ph).map((d) => d.fresh.ph.value);
    out.ph.meanByHydrogen = phMeanByHydrogen(phVals);
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
      params[p] = { value: s.median, min: s.min, max: s.max, count: s.count, ...e, outsideDevices };
    }
    const tb = summary.turbidity_raw;
    params.turbidity_raw = { value: tb.median, min: tb.min, max: tb.max, count: tb.count, state: tb.count ? 'awaiting_calibration' : 'no_data', outsideDevices: [] };

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

  /* ---------- time series: one median per device per bucket, then across devices ---------- */
  function bucketSeries(rows, field, opts) {
    const { start, end, bucketMs, device, validity } = opts;
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
      const arr = perDev.get(r.device_id);
      if (arr) arr.push(v); else perDev.set(r.device_id, [v]);
    }
    const points = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([t, perDev]) => {
      const meds = Array.from(perDev.values()).map(median);
      return { t, median: median(meds), min: Math.min(...meds), max: Math.max(...meds), n: meds.length };
    });
    return { field, start, end, bucketMs, points };
  }

  function seriesChange(points) {
    if (!points || points.length < 2) return null;
    const a = points[0], b = points[points.length - 1];
    return { from: a.median, to: b.median, delta: b.median - a.median, fromAt: a.t, toAt: b.t };
  }
  function outsideShare(points, p) {
    if (!points || !points.length || !isConfigured(p)) return null;
    const bad = points.filter((pt) => { const e = evalThreshold(pt.median, p); return e.state === 'outside' || e.state === 'critical'; }).length;
    return { buckets: points.length, outside: bad, share: bad / points.length };
  }

  /* ---------- deviation from history (modified z-score, Iglewicz & Hoaglin) ---------- */
  function deviationCheck(points, current, cfg) {
    const minPts = (cfg && cfg.minBaselinePoints) || 12;
    const zMax = (cfg && cfg.zThreshold) || 3.5;
    if (current == null) return { evaluated: false, reason: 'No current value' };
    const base = (points || []).slice(0, -1).map((p) => p.median).filter((v) => v != null);
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
    return {
      ph: { value: summary.ph.median, unit: 'pH', statistic: 'median of latest per-device readings (not a mixed-water pH)', classification: classifyPh(summary.ph.median, pc.ph),
        min: summary.ph.min, max: summary.ph.max, devices: summary.ph.count, status: st('ph'), reference: ref('ph'), hydrogenIonMean: summary.ph.meanByHydrogen, latestAt: summary.ph.latestAt },
      temperature: { value: summary.temperature.median, unit: 'C', statistic: 'median', min: summary.temperature.min, max: summary.temperature.max, devices: summary.temperature.count, status: st('temperature'), reference: ref('temperature'), latestAt: summary.temperature.latestAt },
      tds: { value: summary.tds_ppm.median, unit: 'ppm', statistic: 'median', min: summary.tds_ppm.min, max: summary.tds_ppm.max, devices: summary.tds_ppm.count, status: st('tds_ppm'), reference: ref('tds_ppm'), highestDevice: summary.tds_ppm.maxDevice, latestAt: summary.tds_ppm.latestAt },
      turbidity: { value: null, unit: null, raw: summary.turbidity_raw.median, rawMin: summary.turbidity_raw.min, rawMax: summary.turbidity_raw.max, voltage: summary.turbidity_voltage.median, devices: summary.turbidity_raw.count, calibrated: false, status: st('turbidity_raw'), note: 'Raw sensor reading; no validated NTU conversion exists', latestAt: summary.turbidity_raw.latestAt },
    };
  }

  /* ---------- convenience: everything derived from rows, in one call ---------- */
  function analyze(snapshotRows, historyRows, cfg, now, rangeKey, device) {
    const ops = cfg.operations;
    const devices = latestPerDevice(snapshotRows, { now, freshnessMs: ops.freshnessMinutes * 60000, lookbackMs: ops.deviceLookbackHours * 3600000, validity: cfg.validity });
    const scoped = device ? devices.filter((d) => d.device_id === device) : devices;
    const summary = summarize(scoped);
    const assessment = assess(summary, scoped, cfg.parameters, ops);
    const range = cfg.ranges[rangeKey] || cfg.ranges[cfg.defaultRange];
    const series = {};
    for (const f of PARAMS) series[f] = bucketSeries(historyRows, f, { start: now - range.ms, end: now, bucketMs: range.bucketMs, device, validity: cfg.validity });
    const deviations = {};
    for (const p of (cfg.deviation && cfg.deviation.parameters) || []) deviations[p] = deviationCheck(series[p].points, summary[p].median, cfg.deviation);
    const labels = {}; for (const p of PARAMS) labels[p] = cfg.parameters[p].label;
    const alerts = buildAlerts(assessment, deviations, { labels });
    return { now, devices: scoped, allDevices: devices, summary, assessment, series, deviations, alerts, metrics: buildMetrics(summary, assessment, cfg), range: { key: rangeKey, ...range } };
  }

  return { FIELDS, PARAMS, ASSESSED, DISCLAIMER, num, median, validValue, phMeanByHydrogen, classifyPh, latestPerDevice, summarize, evalThreshold, assess, bucketSeries, seriesChange, outsideShare, deviationCheck, buildAlerts, buildMetrics, analyze };
});
