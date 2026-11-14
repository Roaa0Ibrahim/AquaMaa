'use strict';
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.AQUAMAA_DB || path.join(DATA_DIR, 'aquamaa.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,            -- officer | farmer (the two personas, 14 Nov)
  title TEXT NOT NULL,
  institution TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive')),
  data_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wells (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  aquifer TEXT NOT NULL,
  depth_m REAL NOT NULL,
  tds_mgl REAL,
  last_measured TEXT,            -- NULL = data gap
  station_id INTEGER REFERENCES stations(id),
  data_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  period TEXT NOT NULL,          -- YYYY-MM
  water_level_m REAL NOT NULL,
  tds_mgl REAL NOT NULL,
  UNIQUE (station_id, period)
);

CREATE TABLE IF NOT EXISTS extraction_annual (
  year INTEGER PRIMARY KEY,
  agriculture REAL NOT NULL,
  municipal REAL NOT NULL,
  industrial REAL NOT NULL,
  total REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MCM/year',
  source TEXT NOT NULL,
  data_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS safe_yield (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  period TEXT NOT NULL,
  source TEXT NOT NULL,
  data_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  connected INTEGER NOT NULL CHECK (connected IN (0,1)),
  note TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);

-- A farmer's own wells (the farmer account's "My farm" page). Keyed by the account's email, not its id, so the wells
-- a farmer adds survive a re-seed of the demonstration data. device_id links a well to its live sensor.
CREATE TABLE IF NOT EXISTS farm_wells (
  id INTEGER PRIMARY KEY,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  device_id TEXT,
  crop TEXT,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

module.exports = { db, DB_PATH };
