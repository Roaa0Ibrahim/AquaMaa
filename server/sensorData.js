'use strict';
/*
 * Read-only, predefined queries against public.readings, for the assistant's grounding data.
 * Nothing here accepts SQL or table names from a caller.
 */
const { createClient } = require('@supabase/supabase-js');
const { getSupabasePublic } = require('./sensorConfig');

const COLUMNS = 'id,device_id,well_id,ph,temperature,tds_ppm,created_at,ph_raw,ph_voltage,turbidity_raw,turbidity_voltage';

class SensorDataError extends Error {
  constructor(status, code, message, hint) { super(message); this.status = status; this.code = code; this.hint = hint; }
}

let cached = null;
function getClient() {
  const pub = getSupabasePublic();
  if (!pub.ok) throw new SensorDataError(503, 'supabase_not_configured', pub.error);
  if (!cached || cached.url !== pub.url || cached.key !== pub.key) {
    cached = { url: pub.url, key: pub.key, client: createClient(pub.url, pub.key, { auth: { persistSession: false, autoRefreshToken: false } }) };
  }
  return cached.client;
}

function wrap(error) {
  const denied = error.code === '42501' || /permission denied|row-level security/i.test(error.message || '');
  return new SensorDataError(denied ? 403 : 502, denied ? 'supabase_permission_denied' : 'supabase_query_failed',
    `Supabase query failed: ${error.message || 'unknown error'}${error.code ? ` (code ${error.code})` : ''}`,
    denied ? 'Check the Row Level Security SELECT policy on public.readings (see supabase/setup.sql).' : undefined);
}

async function fetchSnapshotRows(cfg, now) {
  const since = new Date(now - cfg.operations.deviceLookbackHours * 3600000).toISOString();
  const { data, error } = await getClient().from('readings').select(COLUMNS)
    .gte('created_at', since).order('created_at', { ascending: false }).limit(cfg.operations.snapshotRowLimit);
  if (error) throw wrap(error);
  return data || [];
}

async function fetchHistoryRows(cfg, now, rangeKey) {
  const range = cfg.ranges[rangeKey] || cfg.ranges[cfg.defaultRange];
  const since = new Date(now - range.ms).toISOString();
  const pageSize = cfg.operations.historyPageSize, cap = cfg.operations.historyRowCap;
  const rows = [];
  let truncated = false;
  for (let from = 0; from < cap; from += pageSize) {
    const { data, error } = await getClient().from('readings').select(COLUMNS)
      .gte('created_at', since).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw wrap(error);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    if (from + pageSize >= cap) truncated = true;
  }
  return { rows, truncated };
}

module.exports = { fetchSnapshotRows, fetchHistoryRows, SensorDataError };
