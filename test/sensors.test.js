'use strict';
// Unit tests for public/lib/sensors.js. Rows below are hand-written TEST FIXTURES, never used by the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/lib/sensors.js');
const cfg = require('../config/thresholds.json');

const NOW = Date.parse('2026-11-09T12:00:00Z');
const min = (m) => new Date(NOW - m * 60000).toISOString();
const row = (device_id, mAgo, extra) => ({ device_id, created_at: min(mAgo), ph: null, temperature: null, tds_ppm: null, turbidity_raw: null, turbidity_voltage: null, ph_raw: null, ph_voltage: null, ...extra });
const opts = { now: NOW, freshnessMs: 60 * 60000, lookbackMs: 168 * 3600000, validity: cfg.validity };

test('each device contributes only its latest reading (not a row average)', () => {
  const rows = [
    row('A', 5, { tds_ppm: 1000 }), row('A', 10, { tds_ppm: 100 }), row('A', 15, { tds_ppm: 100 }), row('A', 20, { tds_ppm: 100 }),
    row('B', 3, { tds_ppm: 500 }), row('C', 4, { tds_ppm: 700 }),
  ];
  const sum = S.summarize(S.latestPerDevice(rows, opts));
  assert.equal(sum.tds_ppm.count, 3);
  assert.equal(sum.tds_ppm.median, 700);        // median(1000, 500, 700), not the mean of all 6 rows
  assert.equal(sum.tds_ppm.min, 500);
  assert.equal(sum.tds_ppm.max, 1000);
  assert.equal(sum.tds_ppm.maxDevice, 'A');
});

test('missing values are never zero and are handled per parameter', () => {
  const rows = [row('A', 2, { ph: 7.2, temperature: null }), row('B', 2, { ph: null, temperature: 30 }), row('C', 2, { ph: 7.4, temperature: 32 })];
  const sum = S.summarize(S.latestPerDevice(rows, opts));
  assert.equal(sum.ph.count, 2);
  assert.ok(Math.abs(sum.ph.median - 7.3) < 1e-9);
  assert.equal(sum.temperature.count, 2);
  assert.equal(sum.temperature.median, 31);
  assert.equal(sum.tds_ppm.median, null);
  assert.equal(sum.tds_ppm.count, 0);
});

test('a device can fall back to its earlier valid value for a parameter that is null in its newest row', () => {
  const rows = [row('A', 2, { tds_ppm: null, ph: 7 }), row('A', 20, { tds_ppm: 800 })];
  const d = S.latestPerDevice(rows, opts)[0];
  assert.equal(d.fresh.tds_ppm.value, 800);
  assert.equal(d.fresh.ph.value, 7);
});

test('stale readings are excluded and the device is reported offline', () => {
  const rows = [row('A', 5, { ph: 7 }), row('OLD', 200, { ph: 4 })];
  const devs = S.latestPerDevice(rows, opts);
  const sum = S.summarize(devs);
  assert.equal(sum.ph.count, 1);
  assert.equal(sum.ph.median, 7);
  assert.deepEqual(devs.filter((d) => !d.online).map((d) => d.device_id), ['OLD']);
});

test('devices with no reading inside the lookback window are not listed', () => {
  const rows = [row('A', 5, { ph: 7 }), row('GONE', 169 * 60, { ph: 7 })];
  assert.deepEqual(S.latestPerDevice(rows, opts).map((d) => d.device_id), ['A']);
});

test('physically impossible values are ignored (pH 15, NaN, strings)', () => {
  const rows = [row('A', 1, { ph: 15 }), row('B', 1, { ph: 'abc' }), row('C', 1, { ph: 7 }), row('D', 1, { temperature: -127 })];
  const sum = S.summarize(S.latestPerDevice(rows, opts));
  assert.equal(sum.ph.count, 1);
  assert.equal(sum.temperature.count, 0);
});

test('rows are handled in any order and bad timestamps are skipped', () => {
  const rows = [row('A', 30, { tds_ppm: 1 }), row('A', 1, { tds_ppm: 2 }), { device_id: 'A', created_at: 'not a date', tds_ppm: 999 }];
  assert.equal(S.latestPerDevice(rows, opts)[0].fresh.tds_ppm.value, 2);
});

test('pH: median is reported, hydrogen-ion mean is computed separately', () => {
  const rows = [row('A', 1, { ph: 6 }), row('B', 1, { ph: 8 })];
  const sum = S.summarize(S.latestPerDevice(rows, opts));
  assert.equal(sum.ph.median, 7);
  // mean [H+] = (1e-6 + 1e-8)/2 = 5.05e-7  ->  pH 6.2967
  assert.ok(Math.abs(sum.ph.meanByHydrogen - 6.2967) < 0.001);
  assert.equal(S.classifyPh(6.0, cfg.parameters.ph), 'Acidic');
  assert.equal(S.classifyPh(7.0, cfg.parameters.ph), 'Neutral');
  assert.equal(S.classifyPh(8.0, cfg.parameters.ph), 'Alkaline');
  assert.equal(S.classifyPh(null, cfg.parameters.ph), null);
});

test('assessment: normal, attention, critical, insufficient data', () => {
  const run = (rows, c = cfg.parameters) => {
    const devs = S.latestPerDevice(rows, opts);
    return S.assess(S.summarize(devs), devs, c, cfg.operations);
  };
  assert.equal(run([row('A', 1, { ph: 7, tds_ppm: 500 }), row('B', 1, { ph: 7.4, tds_ppm: 600 })]).overall, 'normal');

  const attn = run([row('A', 1, { ph: 7, tds_ppm: 500 }), row('B', 1, { ph: 7.4, tds_ppm: 1500 }), row('C', 1, { ph: 7.1, tds_ppm: 400 })]);
  assert.equal(attn.overall, 'attention');
  assert.equal(attn.counts.parametersOutside, 1);
  assert.deepEqual(attn.attentionDevices.map((d) => d.device_id), ['B']);

  assert.equal(run([]).overall, 'insufficient_data');
  assert.equal(run([row('A', 1, { temperature: 30, turbidity_raw: 300 })]).overall, 'insufficient_data'); // nothing assessable

  const crit = JSON.parse(JSON.stringify(cfg.parameters));
  crit.tds_ppm.critical = { max: 2000 };
  assert.equal(run([row('A', 1, { ph: 7, tds_ppm: 2500 })], crit).overall, 'critical');
  // with no critical thresholds configured, 'critical' can never be produced
  assert.notEqual(run([row('A', 1, { ph: 7, tds_ppm: 99999 })]).overall, 'critical');
});

test('temperature has no universal threshold: not assessed unless configured', () => {
  const devs = S.latestPerDevice([row('A', 1, { temperature: 95 })], opts);
  const a = S.assess(S.summarize(devs), devs, cfg.parameters, cfg.operations);
  assert.equal(a.params.temperature.state, 'not_assessed');
  const withRef = JSON.parse(JSON.stringify(cfg.parameters));
  withRef.temperature.reference = { max: 40 };
  assert.equal(S.assess(S.summarize(devs), devs, withRef, cfg.operations).params.temperature.state, 'outside');
});

test('turbidity stays raw: awaiting calibration, never NTU, never in the assessment', () => {
  const rows = [row('A', 1, { ph: 7, tds_ppm: 500, turbidity_raw: 345, turbidity_voltage: 2.1 })];
  const devs = S.latestPerDevice(rows, opts);
  const sum = S.summarize(devs);
  const a = S.assess(sum, devs, cfg.parameters, cfg.operations);
  assert.equal(a.params.turbidity_raw.state, 'awaiting_calibration');
  const m = S.buildMetrics(sum, a, cfg).turbidity;
  assert.equal(m.value, null);
  assert.equal(m.unit, null);
  assert.equal(m.calibrated, false);
  assert.equal(m.raw, 345);
  assert.equal(m.voltage, 2.1);
  // an extreme turbidity reading must not change the overall status
  const rows2 = [row('A', 1, { ph: 7, tds_ppm: 500, turbidity_raw: 999999 })];
  const d2 = S.latestPerDevice(rows2, opts);
  assert.equal(S.assess(S.summarize(d2), d2, cfg.parameters, cfg.operations).overall, 'normal');
});

test('history: a chatty device does not dominate a bucket', () => {
  const start = NOW - 3600000, bucketMs = 3600000;
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push(row('CHATTY', 1 + i * 0.5, { tds_ppm: 1000 }));
  rows.push(row('QUIET1', 10, { tds_ppm: 200 }), row('QUIET2', 12, { tds_ppm: 300 }));
  const s = S.bucketSeries(rows, 'tds_ppm', { start, end: NOW, bucketMs, validity: cfg.validity });
  const b = s.points.find((p) => p.n === 3);
  assert.ok(b, 'all three devices fall in one bucket');
  assert.equal(b.median, 300);   // median of per-device medians (1000, 200, 300); a row mean would be ~960
  assert.equal(b.min, 200);
  assert.equal(b.max, 1000);
});

test('history: device filter returns that device only, gaps stay gaps', () => {
  const rows = [row('A', 10, { ph: 7 }), row('B', 10, { ph: 5 }), row('A', 600, { ph: 7.5 })];
  const s = S.bucketSeries(rows, 'ph', { start: NOW - 86400000, end: NOW, bucketMs: 900000, device: 'A', validity: cfg.validity });
  assert.equal(s.points.length, 2);
  assert.ok(s.points.every((p) => p.n === 1 && p.min === p.max));
});

test('deviation check flags a jump and refuses to judge with too little history', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ t: i, value: 500 + (i % 3) * 5, min: 0, max: 0, n: 1 }));
  assert.equal(S.deviationCheck(pts, 505, cfg.deviation).flag, false);
  const hi = S.deviationCheck(pts, 900, cfg.deviation);
  assert.equal(hi.flag, true);
  assert.equal(hi.direction, 'above');
  assert.equal(S.deviationCheck(pts.slice(0, 5), 900, cfg.deviation).evaluated, false);
  assert.equal(S.deviationCheck(pts, null, cfg.deviation).evaluated, false);
});

test('analyze() ties it together and produces alerts for offline and out-of-range devices', () => {
  const snap = [row('A', 1, { ph: 7, tds_ppm: 1400 }), row('B', 500, { ph: 7, tds_ppm: 300 })];
  const r = S.analyze(snap, snap, cfg, NOW, '24h', null);
  assert.equal(r.assessment.overall, 'attention');
  assert.equal(r.assessment.counts.devicesOffline, 1);
  const types = r.alerts.map((a) => a.type).sort();
  assert.deepEqual(types, ['offline', 'threshold']);
  const one = S.analyze(snap, snap, cfg, NOW, '24h', 'A');
  assert.equal(one.devices.length, 1);
});

/* ---------- per-well aggregation ---------- */
test('sensors in the same well are combined first; each well counts once across the network', () => {
  const rows = [
    row('A', 2, { well_id: 1, temperature: 20, tds_ppm: 400 }), row('B', 2, { well_id: 1, temperature: 22, tds_ppm: 600 }),  // well 1 -> 21 °C, 500 ppm
    row('C', 2, { well_id: 2, temperature: 30, tds_ppm: 3000 }),                                                          // well 2
    row('D', 2, { well_id: 3, temperature: 25, tds_ppm: 700 }),                                                           // well 3
  ];
  const devs = S.latestPerDevice(rows, opts);
  const wells = S.latestPerWell(devs, cfg.aggregation);
  assert.deepEqual(wells.map((w) => w.label), ['Well 1', 'Well 2', 'Well 3']);
  assert.equal(wells[0].fresh.temperature.value, 21);
  assert.equal(wells[0].fresh.tds_ppm.value, 500);
  const sum = S.summarize(devs, cfg.aggregation);
  assert.equal(sum.temperature.count, 3);                       // 3 wells, not 4 sensors
  assert.equal(sum.temperature.devices, 4);
  assert.equal(sum.temperature.statistic, 'mean');
  assert.ok(Math.abs(sum.temperature.value - (21 + 30 + 25) / 3) < 1e-9);
  assert.equal(sum.tds_ppm.statistic, 'median');
  assert.equal(sum.tds_ppm.value, 700);                         // median(500, 3000, 700): the saline well does not drag it
  assert.equal(sum.tds_ppm.maxWell, 'Well 2');
});

test('pH of sensors in one well is averaged on hydrogen-ion activity; wells use the median', () => {
  const rows = [row('A', 1, { well_id: 1, ph: 6 }), row('B', 1, { well_id: 1, ph: 8 }), row('C', 1, { well_id: 2, ph: 7 }), row('D', 1, { well_id: 3, ph: 7.5 })];
  const devs = S.latestPerDevice(rows, opts);
  const w1 = S.latestPerWell(devs, cfg.aggregation)[0];
  assert.ok(Math.abs(w1.fresh.ph.value - S.phMeanByHydrogen([6, 8])) < 1e-9);   // ≈ 6.30, not 7
  const sum = S.summarize(devs, cfg.aggregation);
  assert.equal(sum.ph.value, 7);                                // median(6.30, 7, 7.5)
});

test('a device follows its latest well_id, and time series group by well', () => {
  const rows = [row('A', 1, { well_id: 2, temperature: 24 }), row('A', 30, { well_id: 1, temperature: 20 })];
  assert.equal(S.latestPerDevice(rows, opts)[0].well_id, 2);
  const s = S.bucketSeries([row('A', 5, { well_id: 1, temperature: 20 }), row('B', 5, { well_id: 1, temperature: 22 }), row('C', 5, { well_id: 2, temperature: 30 })],
    'temperature', { start: NOW - 3600000, end: NOW, bucketMs: 3600000, validity: cfg.validity, aggregation: cfg.aggregation });
  assert.equal(s.points.length, 1);
  assert.equal(s.points[0].n, 2);                               // 2 wells
  assert.equal(s.points[0].value, (21 + 30) / 2);
});

test('useLastKnown keeps old readings (flagged stale) while the device still shows offline', () => {
  const rows = [row('A', 3000, { well_id: 1, temperature: 24.5 })];   // ~2 days old
  const strict = S.latestPerDevice(rows, opts);
  assert.equal(strict[0].fresh.temperature, null);
  const lk = S.latestPerDevice(rows, { ...opts, useLastKnown: true });
  assert.equal(lk[0].online, false);
  assert.equal(lk[0].fresh.temperature.value, 24.5);
  assert.equal(lk[0].fresh.temperature.stale, true);
  const sum = S.summarize(lk, cfg.aggregation);
  assert.equal(sum.temperature.value, 24.5);
  assert.equal(sum.temperature.staleWells, 1);
});
