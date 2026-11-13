'use strict';
const base = require('../config/thresholds.json');

function posNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Monitoring configuration (config/thresholds.json) with optional environment overrides. */
function getSensorConfig() {
  const cfg = JSON.parse(JSON.stringify(base));
  const fresh = posNumber(process.env.SENSOR_FRESHNESS_MINUTES);
  const refresh = posNumber(process.env.SENSOR_REFRESH_SECONDS);
  if (fresh) cfg.operations.freshnessMinutes = fresh;
  if (refresh) cfg.operations.refreshSeconds = refresh;
  return cfg;
}

function decodeJwtRole(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role || null; } catch { return null; }
}

/**
 * Public Supabase settings for the browser. Refuses anything that looks like a privileged key,
 * so a service-role key can never be served to a client by mistake.
 */
function getSupabasePublic() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url || !key) {
    return { ok: false, error: 'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in .env (see .env.example).' };
  }
  try { new URL(url); } catch { return { ok: false, error: 'SUPABASE_URL is not a valid URL.' }; }
  if (key.startsWith('sb_secret_') || decodeJwtRole(key) === 'service_role') {
    return { ok: false, error: 'SUPABASE_PUBLISHABLE_KEY looks like a secret/service-role key. Refusing to expose it to the browser; use the publishable (anon) key.' };
  }
  return { ok: true, url, key };
}

module.exports = { getSensorConfig, getSupabasePublic };
