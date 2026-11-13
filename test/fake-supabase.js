'use strict';
/*
 * TEST-ONLY stand-in for Supabase's PostgREST API (GET /rest/v1/readings).
 * It exists so the dashboard and server can be exercised where the real project is unreachable.
 * Its rows are deterministic synthetic FIXTURES; the application never imports or ships this file.
 *
 *   node test/fake-supabase.js [port] [mode]     mode: data (default) | empty | deny | error
 *   POST /__insert  {device_id, ph, ...}          append a row dated "now" (simulates a new reading)
 *   POST /__mode    {mode}                        switch behaviour at runtime
 */
const http = require('http');

const COLS = ['id', 'device_id', 'ph', 'temperature', 'tds_ppm', 'created_at', 'ph_raw', 'ph_voltage', 'turbidity_raw', 'turbidity_voltage'];

function buildRows(now) {
  const rows = [];
  let id = 1;
  const devices = [
    { id: 'well-01', ph: 7.2, t: 27.5, tds: 620, turb: 310 },
    { id: 'well-02', ph: 7.6, t: 28.1, tds: 880, turb: 340 },
    { id: 'well-03', ph: 6.9, t: 26.8, tds: 1260, turb: 410 },
    { id: 'well-04', ph: 8.9, t: 29.0, tds: 760, turb: 295, noTemp: true },     // pH out of range, temperature never reported
    { id: 'well-05', ph: 7.4, t: 27.2, tds: 1710, turb: 380 },                   // TDS above reference
    { id: 'well-06', ph: 7.1, t: 27.9, tds: 540, turb: 300, silentAfterH: 5 },   // stops reporting 5 hours ago
  ];
  const step = 10 * 60000, days = 8;
  const n = (days * 86400000) / step;
  for (let i = n; i >= 0; i--) {
    const ts = now - i * step;
    for (const [di, d] of devices.entries()) {
      if (d.silentAfterH && now - ts < d.silentAfterH * 3600000) continue;
      const w = ts / 3600000;
      const raw = Math.round(d.turb + 12 * Math.sin(w / 3 + di));
      rows.push({
        id: id++, device_id: d.id,
        ph: Number((d.ph + 0.12 * Math.sin(w / 5 + di)).toFixed(2)),
        temperature: d.noTemp ? null : Number((d.t + 0.8 * Math.sin(w / 12 + di)).toFixed(1)),
        tds_ppm: Number((d.tds + 25 * Math.sin(w / 7 + di)).toFixed(0)),
        created_at: new Date(ts).toISOString(),
        ph_raw: 2000 + di, ph_voltage: Number((1.65 + 0.01 * di).toFixed(3)),
        turbidity_raw: raw, turbidity_voltage: Number(((raw * 3.3) / 4095).toFixed(3)),
      });
    }
  }
  return rows;
}

function start({ port = 3200, mode = 'data' } = {}) {
  const now = Date.now();
  const rows = buildRows(now);
  let nextId = rows.length + 1;
  const state = { mode };
  const log = [];

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

    if (u.pathname === '/__log') return json(200, log);
    if (u.pathname === '/__mode' && req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { state.mode = JSON.parse(b).mode; json(200, { mode: state.mode }); }); return;
    }
    if (u.pathname === '/__insert' && req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c));
      req.on('end', () => {
        const r = { id: nextId++, ph: null, temperature: null, tds_ppm: null, ph_raw: null, ph_voltage: null, turbidity_raw: null, turbidity_voltage: null, ...JSON.parse(b), created_at: new Date().toISOString() };
        rows.push(r); json(200, r);
      });
      return;
    }
    if (u.pathname !== '/rest/v1/readings') return json(404, { message: 'not found' });
    log.push({ q: u.search, key: req.headers.apikey || null });

    if (state.mode === 'deny') return json(401, { code: '42501', details: null, hint: null, message: 'permission denied for table readings' });
    if (state.mode === 'error') return json(500, { code: 'XX000', message: 'simulated database failure' });
    if (state.mode === 'empty') return json(200, []);

    let out = rows.slice();
    const gte = u.searchParams.get('created_at');
    if (gte && gte.startsWith('gte.')) { const t = Date.parse(gte.slice(4)); out = out.filter((r) => Date.parse(r.created_at) >= t); }
    const order = u.searchParams.get('order');
    if (order === 'created_at.desc') out.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (order === 'created_at.asc') out.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const off = Number(u.searchParams.get('offset') || 0);
    const lim = u.searchParams.get('limit');
    out = out.slice(off, lim ? off + Number(lim) : undefined);
    const sel = (u.searchParams.get('select') || '*').split(',').map((s) => s.trim());
    const cols = sel.includes('*') ? COLS : sel.filter((c) => COLS.includes(c));
    json(200, out.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))));
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, port, rows, state })));
}

module.exports = { start };
if (require.main === module) {
  start({ port: Number(process.argv[2]) || 3200, mode: process.argv[3] || 'data' }).then(({ port, rows }) => console.log(`fake supabase on :${port} (${rows.length} fixture rows)`));
}
