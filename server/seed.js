'use strict';
/*
 * Seeds the AquaMaa database with DEMONSTRATION data.
 * Every record is flagged with a data_status so the UI can distinguish
 * demonstration data from verified / officially reported data.
 * Replace these tables with real feeds before operational use.
 */
const { db, DB_PATH } = require('./db');
const { hashPassword } = require('./auth');

const DEMO_PASSWORD = process.env.AQUAMAA_DEMO_PASSWORD || 'AquaMaa-Demo-2026';

function reset() {
  db.exec(`DELETE FROM readings; DELETE FROM wells; DELETE FROM stations; DELETE FROM extraction_annual;
           DELETE FROM safe_yield; DELETE FROM data_sources; DELETE FROM notifications; DELETE FROM users; DELETE FROM meta;`);
}

function seedUsers() {
  const users = [
    ['ahmed.almansoori@aquamaa.demo', 'Ahmed Al-Mansoori', 'admin', 'System Administrator', 'AquaMaa Platform'],
    ['water.planning@kahramaa.demo', 'Noora Al-Kuwari', 'kahramaa', 'Water Planning Lead', 'KAHRAMAA'],
    ['groundwater@mecc.demo', 'Khalid Al-Thani', 'mecc', 'Groundwater Specialist', 'Ministry of Environment and Climate Change'],
    ['planning@baladiya.demo', 'Mariam Al-Sulaiti', 'municipality', 'Urban Water Analyst', 'Ministry of Municipality'],
    ['advisor@agri.demo', 'Yousef Al-Naimi', 'agriculture', 'Agricultural Water Advisor', 'Agricultural Affairs Department'],
    ['researcher@university.demo', 'Dr. Layla Haddad', 'researcher', 'Hydrogeology Researcher', 'Academic Research'],
  ];
  const ins = db.prepare('INSERT INTO users (email,name,role,title,institution,password_hash) VALUES (?,?,?,?,?,?)');
  const pw = hashPassword(DEMO_PASSWORD);
  users.forEach((u) => ins.run(...u, pw));
}

function seedGroundwater() {
  const stationRows = [
    ['ST-01', 'Al Shamal Station', 26.05, 51.20, 'active'],
    ['ST-02', 'Al Khor Station', 25.70, 51.40, 'active'],
    ['ST-03', 'Umm Salal Station', 25.42, 51.40, 'active'],
    ['ST-04', 'Dukhan Station', 25.45, 50.95, 'active'],
    ['ST-05', 'Rawdat Rashed Station', 25.20, 51.30, 'active'],
    ['ST-06', 'Al Wakrah Station', 25.10, 51.55, 'active'],
    ['ST-07', 'Abu Samra Station', 24.75, 51.30, 'inactive'],
  ];
  const insSt = db.prepare('INSERT INTO stations (code,name,lat,lon,status,data_status) VALUES (?,?,?,?,?,?)');
  stationRows.forEach((s) => insSt.run(...s, 'demonstration'));

  // [name, lat, lon, aquifer, depth, tds, measured?, stationIndex(1-based) or null]
  const W = [
    ['Al Shamal North', 26.05, 51.20, 'Rus', 85, 2100, 1, 1],
    ['Madinat Ash Shamal', 26.00, 51.15, 'Rus', 92, 2650, 1, null],
    ['Al Ruwais Inland', 26.08, 51.20, 'Rus', 78, 1850, 1, null],
    ['Zubarah', 25.95, 51.03, 'Rus', 110, 3400, 1, null],
    ['Al Jumayliyah', 25.61, 51.09, 'Umm Er Radhuma', 140, 4100, 1, null],
    ['Al Ghuwariyah', 25.82, 51.20, 'Rus', 95, 2300, 1, null],
    ['Al Khor Inland', 25.70, 51.40, 'Rus', 70, 1500, 1, 2],
    ['Al Thakhira', 25.75, 51.45, 'Rus', 66, 960, 1, null],
    ['Al Mazrouah', 25.60, 51.30, 'Rus', 88, 1950, 1, null],
    ['Al Jemailiya', 25.62, 51.20, 'Umm Er Radhuma', 150, 3900, 1, null],
    ['Al Daayen', 25.55, 51.45, 'Rus', 60, 980, 1, null],
    ['Umm Salal', 25.42, 51.40, 'Rus', 72, 1620, 1, 3],
    ['Al Kheesa', 25.40, 51.25, 'Rus', 90, 2200, 1, null],
    ['Al Shahaniyah', 25.38, 51.20, 'Rus', 98, 2480, 1, null],
    ['Dukhan Inland', 25.45, 50.95, 'Umm Er Radhuma', 160, 5200, 1, 4],
    ['Umm Bab', 25.15, 50.90, 'Umm Er Radhuma', 155, 4600, 1, null],
    ['Al Kharsaah', 25.20, 51.10, 'Rus', 105, 3100, 1, null],
    ['Rawdat Al Jahhaniya', 25.28, 51.05, 'Rus', 100, 2900, 0, null],
    ['Al Rayyan', 25.30, 51.40, 'Rus', 58, 850, 1, null],
    ['Rawdat Rashed', 25.20, 51.30, 'Rus', 76, 1400, 1, 5],
    ['Rawdat Al Faras', 25.05, 51.35, 'Rus', 82, 1710, 1, null],
    ['Al Wakrah Inland', 25.10, 51.55, 'Rus', 64, 920, 1, 6],
    ['Umm Qarn', 25.00, 51.10, 'Umm Er Radhuma', 145, 4300, 0, null],
    ['Mesaieed Inland', 24.95, 51.50, 'Rus', 68, 940, 1, null],
    ['Abu Samra', 24.75, 51.30, 'Rus', 115, 3600, 1, 7],
    ['Salwa Road', 24.80, 50.95, 'Umm Er Radhuma', 170, 4800, 0, null],
    ['Al Kharrara', 25.55, 51.15, 'Rus', 94, 2250, 1, null],
    ['Umm Al Amad', 25.72, 51.35, 'Rus', 74, 1760, 1, null],
  ];
  const insW = db.prepare(
    'INSERT INTO wells (code,name,lat,lon,aquifer,depth_m,tds_mgl,last_measured,station_id,data_status) VALUES (?,?,?,?,?,?,?,?,?,?)');
  W.forEach((w, i) => {
    const measured = w[6] ? '2022-12-15' : null;
    insW.run(`W-${String(i + 1).padStart(3, '0')}`, w[0], w[1], w[2], w[3], w[4], measured ? w[5] : null, measured, w[7], 'demonstration');
  });

  // 2022 monthly readings: 7 stations x 12 months = 84 expected slots, 62 received (74%).
  const insR = db.prepare('INSERT INTO readings (station_id,period,water_level_m,tds_mgl) VALUES (?,?,?,?)');
  const perStation = [10, 10, 10, 10, 10, 10, 2];
  perStation.forEach((n, i) => {
    for (let m = 1; m <= n; m++) {
      const level = 18 + i * 1.7 + 0.35 * Math.sin(m / 2) + m * 0.02;
      insR.run(i + 1, `2022-${String(m).padStart(2, '0')}`, Number(level.toFixed(2)), 900 + i * 380 + m * 6);
    }
  });

  // Annual extraction (MCM/year). 2022 = 250.0, 2021 = 238.6 (=> +4.8%).
  const totals = [88, 94, 101, 108, 116, 121, 128, 133, 139, 146, 152, 158, 165, 174, 183, 194, 205, 217, 224, 231, 228, 233, 229.5, 238.6, 250];
  const insE = db.prepare('INSERT INTO extraction_annual (year,agriculture,municipal,industrial,total,source,data_status) VALUES (?,?,?,?,?,?,?)');
  totals.forEach((t, i) => {
    const year = 1998 + i;
    const ag = 0.58 + (i * 0.04) / 24;
    const mu = 0.25 - (i * 0.02) / 24;
    const a = Number((t * ag).toFixed(1));
    const m = Number((t * mu).toFixed(1));
    const n = Number((t - a - m).toFixed(1));
    insE.run(year, a, m, n, t, 'National water accounts (demonstration series)', 'demonstration');
  });

  db.prepare('INSERT INTO safe_yield (id,value,unit,period,source,data_status) VALUES (1,?,?,?,?,?)')
    .run(49.6, 'MCM/year', '2022', 'Aquifer recharge estimate (demonstration)', 'estimated');

  const insDs = db.prepare('INSERT INTO data_sources (name,provider,connected,note) VALUES (?,?,?,?)');
  [
    ['National water accounts', 'Planning and Statistics Authority', 1, 'Annual extraction series'],
    ['Well registry', 'Ministry of Municipality', 1, 'Registered wells'],
    ['Monitoring station telemetry', 'Ministry of Environment and Climate Change', 1, 'Monthly water level and TDS'],
    ['Aquifer recharge model', 'Research partners', 0, 'Not yet integrated'],
    ['Agricultural abstraction licences', 'Agricultural Affairs Department', 0, 'Not yet integrated'],
  ].forEach((d) => insDs.run(...d));

  const insN = db.prepare('INSERT INTO notifications (severity,title,body,created_at,read) VALUES (?,?,?,?,0)');
  insN.run('warning', 'Station ST-07 inactive', 'Abu Samra Station has reported only 2 of 12 monthly readings for 2022.', '2026-11-07T08:10:00+03:00');
  insN.run('warning', 'Extraction exceeds estimated safe yield', 'Reported extraction is 5.04x the estimated safe yield for the same period. Review recommended.', '2026-11-06T16:30:00+03:00');
  insN.run('info', '3 wells without recent measurements', 'W-018, W-023 and W-026 have no recorded measurement. Field verification is advised.', '2026-11-05T11:00:00+03:00');

  const insM = db.prepare('INSERT INTO meta (key,value) VALUES (?,?)');
  insM.run('last_data_update', '2026-11-07T09:42:00+03:00');
  insM.run('mode', 'demonstration');
}

reset();
seedUsers();
seedGroundwater();
console.log(`Seeded ${DB_PATH}`);
console.log(`Demo password for all demo users: ${DEMO_PASSWORD}`);
