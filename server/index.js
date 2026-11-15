'use strict';
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* .env is optional; real environment variables still apply */ }
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');
const sensorConfig = require('./sensorConfig');
const { getSupabasePublic } = sensorConfig;
const { createAssistantRouter } = require('./assistant');

const app = express();
app.disable('x-powered-by');
// The assistant router has its own, larger body limit (it receives page context).
const smallJson = express.json({ limit: '10kb' });
app.use((req, res, next) => (req.path.startsWith('/api/assistant') ? next() : smallJson(req, res, next)));

// Basic security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const YEAR_MIN = 1998;
const YEAR_MAX = 2022;
const SAFE_TDS = 1000; // mg/L, demonstration suitability threshold

// ---------- helpers ----------
const round = (n, d = 1) => (n == null ? null : Number(Number(n).toFixed(d)));

function parseYear(v) {
  if (v == null || v === '') return YEAR_MAX;
  const y = Number(v);
  if (!Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) return null;
  return y;
}

function requireAuth(req, res, next) {
  const uid = auth.sessionUserId(req);
  const user = uid && db.prepare('SELECT id,email,name,role,title,institution FROM users WHERE id=?').get(uid);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

const ROLE_INSIGHTS = {
  officer: 'Monitoring view: live well sensors and their alerts first. The registry, map and extraction figures are demonstration data until the official feeds are connected.',
  farmer: 'Your farm: each of your wells with its live reading, what it means for your crops, and what to do.',
  admin: 'Platform-wide view. Live sensor indicators come from the Supabase readings table; the registry, map and extraction figures are still demonstration data.',
  kahramaa: 'Supply planning: municipal abstraction is the share most relevant to KAHRAMAA. Compare it with the estimated safe yield before committing groundwater to new supply.',
  mecc: 'Environmental protection: extraction far exceeds the estimated safe yield for the same period. Prioritise recharge studies and verification of the estimate.',
  municipality: 'Urban planning: only a small share of registered wells meet the TDS threshold. Treat remaining wells as candidates for treatment or non-potable use.',
  agriculture: 'Agriculture is the largest abstraction sector. Salinity limits crop suitability; review well TDS before allocating irrigation sources.',
  researcher: 'Research view: figures are demonstration data. Use the status labels to separate measured, estimated and demonstration values.',
};

// ---------- auth ----------
app.post('/api/auth/login', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  if (!email || !password || email.length > 200 || password.length > 200) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const key = `${req.ip}|${email}`;
  if (auth.throttled(key)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!row || !auth.verifyPassword(password, row.password_hash)) {
    auth.recordFailure(key);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  auth.clearFailures(key);
  auth.setSession(res, row.id);
  const { id, name, role, title, institution } = row;
  res.json({ user: { id, email: row.email, name, role, title, institution } });
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

// ---------- the farmer's own wells (My farm) ----------
const DEVICE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const clean = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
function requireFarmer(req, res, next) {
  if (req.user.role !== 'farmer') return res.status(403).json({ error: 'Only the farmer account has a farm' });
  next();
}
app.get('/api/farm/wells', requireAuth, requireFarmer, (req, res) => {
  res.json({ wells: db.prepare('SELECT id,name,device_id,crop,location,created_at FROM farm_wells WHERE owner_email=? ORDER BY id')
    .all(req.user.email) });
});
app.post('/api/farm/wells', requireAuth, requireFarmer, (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 60), crop = clean(b.crop, 40), location = clean(b.location, 60);
  const device = clean(b.device_id, 64) || null;
  if (!name) return res.status(400).json({ error: 'Give the well a name' });
  if (device && !DEVICE_ID.test(device)) return res.status(400).json({ error: 'The sensor ID is not valid' });
  const n = db.prepare('SELECT COUNT(*) c FROM farm_wells WHERE owner_email=?').get(req.user.email).c;
  if (n >= 50) return res.status(400).json({ error: 'A farm can have up to 50 wells here' });
  const r = db.prepare('INSERT INTO farm_wells (owner_email,name,device_id,crop,location) VALUES (?,?,?,?,?)')
    .run(req.user.email, name, device, crop || null, location || null);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.delete('/api/farm/wells/:id', requireAuth, requireFarmer, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  db.prepare('DELETE FROM farm_wells WHERE id=? AND owner_email=?').run(id, req.user.email);
  res.json({ ok: true });
});

// Public: demo accounts listed on the login page (demo mode only).
app.get('/api/auth/demo-accounts', (req, res) => {
  const mode = db.prepare("SELECT value FROM meta WHERE key='mode'").get();
  if (!mode || mode.value !== 'demonstration') return res.json({ accounts: [] });
  res.json({ accounts: db.prepare('SELECT email,name,title,institution FROM users ORDER BY id').all() });
});

// ---------- data ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const year = parseYear(req.query.year);
  if (year == null) return res.status(400).json({ error: `year must be an integer between ${YEAR_MIN} and ${YEAR_MAX}` });

  const cur = db.prepare('SELECT * FROM extraction_annual WHERE year=?').get(year);
  const sy = db.prepare('SELECT * FROM safe_yield WHERE id=1').get();
  const trend = db.prepare('SELECT year,total FROM extraction_annual ORDER BY year').all();

  const wells = db.prepare('SELECT * FROM wells').all();
  const stations = db.prepare('SELECT * FROM stations').all();
  const periodPrefix = `${year}-`;
  const received = db.prepare('SELECT COUNT(*) c FROM readings WHERE period LIKE ?').get(`${periodPrefix}%`).c;
  const expected = stations.length * 12;
  const meta = Object.fromEntries(db.prepare('SELECT key,value FROM meta').all().map((m) => [m.key, m.value]));

  // The safe-yield estimate applies to a single reporting period; only compare like with like.
  const comparable = cur && sy && String(year) === sy.period;
  const sectorTotal = cur ? cur.agriculture + cur.municipal + cur.industrial : 0;
  const pct = (v) => (sectorTotal ? round((v / sectorTotal) * 100, 0) : null);

  res.json({
    year,
    mode: meta.mode,
    updated_at: meta.last_data_update,
    insight: ROLE_INSIGHTS[req.user.role] || ROLE_INSIGHTS.researcher,
    extraction: cur && {
      value: cur.total, unit: cur.unit, period: String(year),
      source: cur.source, status: cur.data_status,
    },
    safe_yield: sy && { value: sy.value, unit: sy.unit, period: sy.period, source: sy.source, status: sy.data_status },
    ratio: comparable ? round(cur.total / sy.value, 2) : null,
    wells: { count: wells.length, status: 'demonstration' },
    // Water level (depth to water below ground, m) across the monitoring stations, month by month: demonstration
    // data, like the stations (14 Nov: the officer's page on Pepper shows it; no live water-level sensor yet)
    water_level: (() => {
      // Only the stations reporting in the latest month, so every month averages the same stations (a station that
      // stopped reporting would otherwise shift the average and fake a change)
      const lastPeriod = db.prepare('SELECT MAX(period) p FROM readings WHERE period LIKE ?').get(`${periodPrefix}%`).p;
      const months = lastPeriod ? db.prepare(`SELECT period, AVG(water_level_m) avg, COUNT(*) n FROM readings
        WHERE period LIKE ? AND station_id IN (SELECT station_id FROM readings WHERE period = ?)
        GROUP BY period ORDER BY period`).all(`${periodPrefix}%`, lastPeriod) : [];
      if (!months.length) return null;
      const first = months[0], last = months[months.length - 1];
      return { latest: round(last.avg, 2), period: last.period, stations: last.n, change: round(last.avg - first.avg, 2),
        since: first.period, series: months.map((m) => round(m.avg, 2)), unit: 'm below ground', status: 'demonstration' };
    })(),
    stations: {
      count: stations.length,
      active: stations.filter((s) => s.status === 'active').length,
      expected, received,
      coverage_pct: received ? round((received / expected) * 100, 0) : null,
    },
    trend,
    sectors: cur && {
      total: cur.total, unit: cur.unit, source: cur.source, status: cur.data_status,
      items: [
        { key: 'agriculture', value: cur.agriculture, pct: pct(cur.agriculture) },
        { key: 'municipal', value: cur.municipal, pct: pct(cur.municipal) },
        { key: 'industrial', value: cur.industrial, pct: pct(cur.industrial) },
      ],
    },
    coverage: {
      wells: wells.length,
      stations: stations.length,
      data_gaps: wells.filter((w) => w.last_measured == null).length,
    },
  });
});

app.get('/api/wells', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT w.*, s.code AS station_code FROM wells w LEFT JOIN stations s ON s.id=w.station_id ORDER BY w.code`).all();
  res.json({
    threshold_tds_mgl: SAFE_TDS,
    wells: rows.map((w) => ({
      ...w,
      suitable: w.tds_mgl == null ? null : w.tds_mgl <= SAFE_TDS,
      data_gap: w.last_measured == null,
    })),
  });
});

app.get('/api/stations', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM readings r WHERE r.station_id=s.id AND r.period LIKE '2022-%') AS readings_2022
    FROM stations s ORDER BY s.code`).all();
  res.json({ stations: rows });
});

app.get('/api/stations/:id/readings', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid station id' });
  res.json({ readings: db.prepare('SELECT period,water_level_m,tds_mgl FROM readings WHERE station_id=? ORDER BY period').all(id) });
});

app.get('/api/extraction', requireAuth, (req, res) => {
  res.json({ series: db.prepare('SELECT * FROM extraction_annual ORDER BY year').all() });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  res.json({ notifications: db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all(),
    unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE read=0').get().c });
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  db.prepare('UPDATE notifications SET read=1 WHERE id=?').run(id);
  res.json({ ok: true });
});

// ---------- live sensor configuration (public values only) ----------
app.get('/api/config', requireAuth, (req, res) => {
  const pub = getSupabasePublic();
  res.json({
    supabase: pub.ok ? { url: pub.url, publishableKey: pub.key } : null,
    configError: pub.ok ? null : pub.error,
    sensors: sensorConfig.getSensorConfig(),
  });
});

// Browser build of supabase-js, served locally so the dashboard does not depend on a CDN.
app.get('/vendor/supabase.js', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'));
});

// ---------- AI assistant (model call is a stub; see server/assistant-model.js) ----------
app.use('/api/assistant', createAssistantRouter({ requireAuth }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- static frontend ----------
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ---------- errors ----------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`AquaMaa running on http://localhost:${PORT}`));
  require('./notifier').startNotifier();   // Telegram alerts; does nothing unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set
}
module.exports = app;
