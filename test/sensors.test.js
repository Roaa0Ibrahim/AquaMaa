'use strict';
// Unit tests for public/lib/sensors.js. Rows below are hand-written TEST FIXTURES, never used by the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/lib/sensors.js');
const cfg = require('../config/thresholds.json');

const NOW = Date.parse('2026-11-09T12:00:00Z');
const min = (m) => new Date(NOW - m * 60000).toISOString();
const row = (device_id, mAgo, extra) => ({ device_id, created_at: min(mAgo), ph: null, temperature: null, tds_ppm: null, turbidity_index: null, turbidity_status: null, water_level_status: null, ...extra });
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
  assert.equal(run([row('A', 1, { turbidity_index: 3 })]).overall, 'insufficient_data'); // nothing assessable (no turbidity limit)

  const crit = JSON.parse(JSON.stringify(cfg.parameters));
  crit.tds_ppm.critical = { max: 2000 };
  assert.equal(run([row('A', 1, { ph: 7, tds_ppm: 2500 })], crit).overall, 'critical');
  // with no critical thresholds configured, 'critical' can never be produced
  const noCrit = JSON.parse(JSON.stringify(cfg.parameters));
  for (const k of Object.keys(noCrit)) noCrit[k].critical = null;
  assert.notEqual(run([row('A', 1, { ph: 7, tds_ppm: 99999 })], noCrit).overall, 'critical');
  // with the configured critical limits (TDS above 2000), the same water is critical
  assert.equal(run([row('A', 1, { ph: 7, tds_ppm: 99999 })]).overall, 'critical');
});

test('temperature: not assessed without limits; with the configured operational band it is', () => {
  const devs = S.latestPerDevice([row('A', 1, { temperature: 95 })], opts);
  const noLimits = JSON.parse(JSON.stringify(cfg.parameters));
  noLimits.temperature.reference = null; noLimits.temperature.critical = null;
  assert.equal(S.assess(S.summarize(devs), devs, noLimits, cfg.operations).params.temperature.state, 'not_assessed');
  assert.equal(S.assess(S.summarize(devs), devs, cfg.parameters, cfg.operations).params.temperature.state, 'critical'); // above 40
  const ok = S.latestPerDevice([row('A', 1, { temperature: 26 })], opts);
  assert.equal(S.assess(S.summarize(ok), ok, cfg.parameters, cfg.operations).params.temperature.state, 'within');
});

test('turbidity index: shown, never NTU, not assessed while no limit is configured', () => {
  const rows = [row('A', 1, { ph: 7, tds_ppm: 500, turbidity_index: 2.7, turbidity_status: 'CLEAR' })];
  const devs = S.latestPerDevice(rows, opts);
  const sum = S.summarize(devs);
  const a = S.assess(sum, devs, cfg.parameters, cfg.operations);
  assert.equal(a.params.turbidity_index.state, 'not_assessed');
  const m = S.buildMetrics(sum, a, cfg).turbidity;
  assert.equal(m.value, 2.7);
  assert.match(m.unit, /not NTU/);
  // an extreme turbidity reading must not change the overall status
  const rows2 = [row('A', 1, { ph: 7, tds_ppm: 500, turbidity_index: 999999 })];
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
  // TDS 1400 ppm: above the reference, too salty for several crops, and the index drops
  assert.deepEqual(types, ['offline', 'threshold', 'water_use', 'wqi']);
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

/* ---------- CCME Water Quality Index ---------- */
test('CCME WQI matches a hand calculation', () => {
  const ph = { min: 6.5, max: 8.5 }, tds = { max: 1000 };
  const r = S.ccmeIndex({
    ph: [7, 7, 9, 7].map((value) => ({ value, objective: ph })),            // one failure: 9/8.5 − 1 = 0.0588
    tds_ppm: [500, 1500, 500, 500].map((value) => ({ value, objective: tds })), // one failure: 1500/1000 − 1 = 0.5
  });
  assert.equal(r.F1, 100);                       // both variables failed at least once
  assert.equal(r.F2, 25);                        // 2 of 8 tests
  const nse = (9 / 8.5 - 1 + 0.5) / 8;
  assert.ok(Math.abs(r.F3 - nse / (0.01 * nse + 0.01)) < 1e-9);
  assert.ok(Math.abs(r.wqi - (100 - Math.sqrt(100 ** 2 + 25 ** 2 + r.F3 ** 2) / 1.732)) < 1e-9);
  assert.equal(r.category, 'Poor');
  assert.equal(S.ccmeIndex({ ph: [7, 7.2].map((value) => ({ value, objective: ph })) }).wqi, 100);
  assert.equal(S.wqiCategory(85), 'Good');
});

test('CCME WQI per well: one test per bucket, only parameters with limits, lowest well first', () => {
  const rows = [];
  for (let m = 0; m < 6; m++) {
    rows.push(row('A', 5 + m * 15, { well_id: 1, ph: 7.2, tds_ppm: 400, temperature: 25, turbidity_index: 3 }));
    rows.push(row('A', 6 + m * 15, { well_id: 1, ph: 7.2, tds_ppm: 410 }));                 // same bucket: still one test
    rows.push(row('B', 5 + m * 15, { well_id: 2, ph: 7.0, tds_ppm: m < 3 ? 2500 : 600 }));   // half the buckets too salty
  }
  const w = S.ccmeWqi(rows, cfg, { start: NOW - 3 * 3600000, end: NOW, bucketMs: 15 * 60000 });
  assert.deepEqual(w.parameters, ['ph', 'tds_ppm', 'temperature']);
  assert.deepEqual(w.excluded.map((e) => e.param), ['turbidity_index']);
  assert.equal(w.headline.well, 'Well 2');
  assert.equal(w.headline.tests, 12);            // 6 buckets × pH and TDS (well 2 reports no temperature)
  assert.equal(w.headline.failedTests, 3);
  assert.equal(w.headline.sufficient, false);    // one variable missing
  const w1 = w.wells.find((x) => x.well === 'Well 1');
  assert.equal(w1.wqi, 100);
  assert.equal(w1.tests, 18);                    // 6 buckets × 3 parameters
  assert.equal(w1.sufficient, true);
});

/* ---------- Water Card and its alerts ---------- */
test('Water Card: crops by FAO 29 no-loss salinity, drinking by taste; alert lists lost and kept uses', () => {
  const card = (tds, ph = 7.5) => S.waterCard(S.latestPerWell(S.latestPerDevice([row('A', 1, { well_id: 1, tds_ppm: tds, ph })], opts), cfg.aggregation), cfg)[0];
  const fresh = card(90);
  assert.ok(fresh.uses.every((u) => u.ok));
  assert.equal(fresh.uses.find((u) => u.id === 'drinking').level, 'ok');
  const salty = card(1500);                                          // above tomato (1088), below date palm (1728)
  const by = Object.fromEntries(salty.uses.map((u) => [u.id, u.ok]));
  assert.equal(by.tomato, false); assert.equal(by.lettuce, false); assert.equal(by.drinking, false);
  assert.equal(by['date palm'], true); assert.equal(by.barley, true);
  const alerts = S.extraAlerts([salty], { wells: [] }, cfg);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'water_use');
  assert.equal(alerts[0].severity, 'warning');
  assert.match(alerts[0].title, /not suitable for .*tomato/);
  assert.match(alerts[0].title, /still suitable for .*date palm/);
  const brine = S.extraAlerts([card(5000)], { wells: [] }, cfg)[0];
  assert.equal(brine.severity, 'critical');                          // no listed crop left
  assert.equal(S.extraAlerts([fresh], { wells: [] }, cfg).length, 0);
  assert.equal(card(300, 9.2).uses.find((u) => u.id === 'drinking').ok, false); // pH outside 6.5-8.5
});

test('WQI alert: raised for Marginal or Poor wells only, Poor is critical', () => {
  const mk = (wqi, category) => ({ period: 'Last 24 hours', wells: [{ well: 'Well 1', wqi, category, failedVariables: ['ph'], failedTests: 4, tests: 8 }] });
  assert.equal(S.extraAlerts([], mk(90, 'Good'), cfg).length, 0);
  const m = S.extraAlerts([], mk(59, 'Marginal'), cfg)[0];
  assert.equal(m.severity, 'warning'); assert.match(m.title, /59 out of 100, marginal, because of pH\./);
  assert.equal(S.extraAlerts([], mk(30, 'Poor'), cfg)[0].severity, 'critical');
});

test('turbidity alerts use the unusual-change check (no calibration needed)', () => {
  assert.ok(cfg.deviation.parameters.includes('turbidity_index'));
  const pts = Array.from({ length: 20 }, (_, i) => ({ t: i, value: 3000 + (i % 3) * 10 }));
  assert.equal(S.deviationCheck(pts, 1500, cfg.deviation).flag, true);
});

test('Telegram message format', () => {
  const { format } = require('../server/notifier.js');
  const a = { title: 'Well 1 water, at 1,500 ppm, is not suitable for tomato.', detail: 'Tomato: TDS 1500 above 1088', severity: 'warning' };
  assert.match(format(a, 'alert'), /^⚠️ AquaMaa · Alert · \d\d:\d\d AST\nWell 1 water/);
  assert.match(format({ ...a, severity: 'critical' }, 'alert'), /^🔴 AquaMaa · URGENT/);
  assert.match(format(a, 'cleared'), /^✅ AquaMaa · Resolved/);
  assert.doesNotMatch(format(a, 'cleared'), /Tomato: TDS/);
});

/* ---------- device status text (turbidity_status, water_level_status) ---------- */
test('status alerts: NO WATER and a non-clear turbidity raise alerts; CLEAR and OK do not', () => {
  const run = (extra) => {
    const devs = S.latestPerDevice([row('A', 1, { well_id: 1, ph: 7.2, tds_ppm: 300, temperature: 25, ...extra })], opts);
    const wells = S.latestPerWell(devs, cfg.aggregation);
    return S.extraAlerts([], { wells: [] }, cfg, wells).filter((x) => x.type === 'status');
  };
  assert.equal(run({ turbidity_status: 'CLEAR', water_level_status: 'OK' }).length, 0);
  const nw = run({ turbidity_status: 'CLEAR', water_level_status: 'NO WATER' });
  assert.equal(nw.length, 1);
  assert.equal(nw[0].param, 'water_level_status');
  assert.match(nw[0].title, /^Well 1: the water level sensor reports "NO WATER"\. Check the well/);
  const tb = run({ turbidity_status: 'Dirty' });
  assert.equal(tb.length, 1);
  assert.equal(tb[0].severity, 'critical');
  // the newest status wins
  const devs = S.latestPerDevice([row('A', 1, { well_id: 1, water_level_status: 'OK' }), row('A', 5, { well_id: 1, water_level_status: 'NO WATER' })], opts);
  assert.equal(S.latestPerWell(devs, cfg.aggregation)[0].status.water_level_status.value, 'OK');
});
