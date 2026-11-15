'use strict';
// Server tests against the TEST-ONLY fake Supabase. They never touch the real project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fake = require('./fake-supabase');

let fk, base, app, srv;
const PW = 'AquaMaa-Demo-2026';

test.before(async () => {
  fk = await fake.start({ port: 3291 });
  process.env.SUPABASE_URL = 'http://localhost:3291';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  process.env.AQUAMAA_DB = require('path').join(require('os').tmpdir(), `aq-test-${process.pid}.db`);
  process.argv[1] = 'x';
  require('child_process').execFileSync(process.execPath, ['--no-warnings', 'server/seed.js'], { env: process.env, cwd: require('path').join(__dirname, '..') });
  app = require('../server/index.js');
  srv = app.listen(0);
  base = `http://localhost:${srv.address().port}`;
});
test.after(() => { srv.close(); fk.server.close(); });

async function login(email = 'officer@aquamaa.demo') {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const post = (path, cookie, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie || '' }, body: JSON.stringify(body) });

test('config endpoint needs a session and returns only public values', async () => {
  assert.equal((await fetch(`${base}/api/config`)).status, 401);
  const c = await login();
  const j = await (await fetch(`${base}/api/config`, { headers: { cookie: c } })).json();
  assert.equal(j.supabase.url, 'http://localhost:3291');
  assert.equal(j.supabase.publishableKey, 'sb_publishable_test_only');
  assert.ok(j.sensors.parameters.ph);
  assert.ok(!JSON.stringify(j).match(/password|service_role|SUPABASE_DB_URL/i));
});

test('a service-role style key is never served to the browser', async () => {
  const c = await login();
  const saved = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_secret_abc';
  const j = await (await fetch(`${base}/api/config`, { headers: { cookie: c } })).json();
  process.env.SUPABASE_PUBLISHABLE_KEY = saved;
  assert.equal(j.supabase, null);
  assert.match(j.configError, /secret/);
});

test('dashboard API no longer carries the removed KPI data', async () => {
  const c = await login();
  const d = await (await fetch(`${base}/api/dashboard?year=2022`, { headers: { cookie: c } })).json();
  assert.equal(d.integrations, undefined);
  assert.equal(d.extraction.spark, undefined);
  assert.equal(d.extraction.yoy_pct, undefined);
  assert.equal(d.safe_yield.value, 49.6);      // kept for the Resource balance panel
  assert.equal(d.ratio, 5.04);
});

test('assistant: validation', async () => {
  const c = await login();
  assert.equal((await post('/api/assistant', null, { message: 'hi', page: 'dashboard' })).status, 401);
  assert.equal((await post('/api/assistant', c, { page: 'dashboard' })).status, 400);
  assert.equal((await post('/api/assistant', c, { message: 'x'.repeat(2001), page: 'dashboard' })).status, 400);
  assert.equal((await post('/api/assistant', c, { message: 'hi', page: 'nope' })).status, 400);
  assert.equal((await post('/api/assistant', c, { message: 'hi', page: 'dashboard', context: { dateRange: 'forever' } })).status, 400);
  assert.equal((await post('/api/assistant', c, { message: 'hi', page: 'dashboard', context: { selectedDevice: "x'; drop table readings;--" } })).status, 400);
});

test('assistant context: live data from the database, grounded and honest about gaps', async () => {
  const c = await login();
  const r = await post('/api/assistant/context', c, { page: 'dashboard', context: { dateRange: '24h', selectedDevice: null, filters: { year: 2022 } } });
  assert.equal(r.status, 200);
  const g = await r.json();
  assert.equal(g.live.devices.length, 6);
  assert.equal(g.live.metrics.turbidity.calibrated, false);
  assert.equal(g.live.metrics.turbidity.value, null);
  assert.equal(g.live.metrics.turbidity.unit, null);
  const offline = g.live.assessment.offlineDevices.map((d) => d.device_id);
  assert.deepEqual(offline, ['well-06']);
  assert.equal(g.live.assessment.overall, 'attention');
  assert.equal(g.live.metrics.tds.highestDevice, 'well-05');
  assert.ok(g.notAvailable.some((s) => /NTU/.test(s)));
  assert.equal(g.clientContext.filters.year, 2022);
  assert.ok(g.live.series.ph.points.length > 10 && g.live.series.ph.points.length <= 48);
  // device-scoped context
  const one = await (await post('/api/assistant/context', c, { page: 'quality', context: { selectedDevice: 'well-05' } })).json();
  assert.equal(one.live.devices.length, 1);
  assert.equal(one.selectedDevice, 'well-05');
});

test('assistant: model is a stub, so the endpoint answers 501 and never invents a reply', async () => {
  const c = await login();
  const r = await post('/api/assistant', c, { message: 'Which well has the highest TDS?', page: 'dashboard', context: {} });
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'assistant_not_connected');
});

test('database problems are reported exactly, not replaced with data', async () => {
  const c = await login();
  await fetch('http://localhost:3291/__mode', { method: 'POST', body: JSON.stringify({ mode: 'deny' }) });
  let r = await post('/api/assistant/context', c, { page: 'dashboard' });
  let j = await r.json();
  assert.equal(r.status, 403);
  assert.equal(j.error, 'supabase_permission_denied');
  assert.match(j.message, /permission denied/);
  await fetch('http://localhost:3291/__mode', { method: 'POST', body: JSON.stringify({ mode: 'error' }) });
  r = await post('/api/assistant/context', c, { page: 'dashboard' });
  assert.equal(r.status, 502);
  await fetch('http://localhost:3291/__mode', { method: 'POST', body: JSON.stringify({ mode: 'empty' }) });
  r = await post('/api/assistant/context', c, { page: 'dashboard' });
  j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.live.assessment.overall, 'insufficient_data');
  assert.equal(j.live.devices.length, 0);
  await fetch('http://localhost:3291/__mode', { method: 'POST', body: JSON.stringify({ mode: 'data' }) });
});
