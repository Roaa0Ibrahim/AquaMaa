'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Session secret persisted on disk so sessions survive restarts.
const SECRET_FILE = path.join(__dirname, '..', 'data', '.session-secret');
function loadSecret() {
  if (process.env.AQUAMAA_SECRET) return process.env.AQUAMAA_SECRET;
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8');
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();
const COOKIE = 'aquamaa_session';
const MAX_AGE_S = 60 * 60 * 8;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest();
  let given;
  try { given = Buffer.from(mac, 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, userId) {
  const token = sign({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function sessionUserId(req) {
  const p = verify(parseCookies(req.headers.cookie)[COOKIE]);
  return p ? p.uid : null;
}

// Simple in-memory login throttle: 8 failures / 10 min per ip+email.
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 600000);
  attempts.set(key, list);
  return list.length >= 8;
}
function recordFailure(key) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
function clearFailures(key) { attempts.delete(key); }

module.exports = { hashPassword, verifyPassword, setSession, clearSession, sessionUserId, throttled, recordFailure, clearFailures };
