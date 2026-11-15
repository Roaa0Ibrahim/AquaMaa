'use strict';
/*
 * Telegram alerts. Watches the same live analysis the dashboard shows (public/lib/sensors.js) and
 * sends each NEW alert once to Telegram, plus a "resolved" message when it clears.
 * Off unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in .env (never sent to the browser).
 *
 *   Setup:  1. In Telegram, message @BotFather, send /newbot, copy the token into .env as TELEGRAM_BOT_TOKEN
 *           2. Send any message to your new bot (or add it to a group and write in the group)
 *           3. node server/notifier.js --chat-id      prints the chat id; put it in .env as TELEGRAM_CHAT_ID
 *           4. node server/notifier.js --test         sends a test message
 *   Several chats: TELEGRAM_CHAT_ID=111,222
 *   Anyone can also send /subscribe to the bot (kept in the local database, table telegram_subscribers).
 *
 * Alerts that already exist when the server starts are not sent (no backlog), like Pepper's.
 */
const path = require('path');
const S = require('../public/lib/sensors.js');
const { getSensorConfig } = require('./sensorConfig');
const data = require('./sensorData');

const API = 'https://api.telegram.org';
const MAX_PER_POLL = 8;               // never flood a chat
const WINDOW_MS = 24 * 3600000;       // rows kept in memory (the 24 h analysis window)

function settings() {
  return {
    token: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    chats: (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean),
    pollMs: Math.max(5, Number(process.env.TELEGRAM_POLL_SECONDS) || 10) * 1000,
  };
}

/* Who gets alerts: the chats in TELEGRAM_CHAT_ID (.env) plus everyone who sent /subscribe. */
function subscribers() {
  const { db } = require('./db');
  return db.prepare('SELECT chat_id, name FROM telegram_subscribers ORDER BY created_at').all();
}
function subscribe(chatId, name) {
  const { db } = require('./db');
  const had = db.prepare('SELECT 1 FROM telegram_subscribers WHERE chat_id = ?').get(String(chatId));
  db.prepare('INSERT INTO telegram_subscribers (chat_id, name) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name').run(String(chatId), name || null);
  return !had;
}
function unsubscribe(chatId) {
  const { db } = require('./db');
  return db.prepare('DELETE FROM telegram_subscribers WHERE chat_id = ?').run(String(chatId)).changes > 0;
}
function recipients() {
  return Array.from(new Set([...settings().chats, ...subscribers().map((r) => r.chat_id)]));
}

async function send(token, chatId, text) {
  const r = await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const err = new Error(`Telegram ${r.status}: ${(await r.text()).slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
}
/* Sends to every recipient; a chat that blocked the bot (403) is unsubscribed. */
async function broadcast(token, text, log) {
  for (const chat of recipients()) {
    try { await send(token, chat, text); } catch (e) {
      if (e.status === 403 && unsubscribe(chat)) log.log(`Telegram alerts: chat ${chat} blocked the bot, unsubscribed`);
      else log.error(`Telegram alerts: ${e.message}`);
    }
  }
}

const AST = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Qatar' });
function format(alert, kind) {
  const icon = kind === 'cleared' ? '✅' : alert.severity === 'critical' ? '🔴' : '⚠️';
  const head = kind === 'cleared' ? 'Resolved' : alert.severity === 'critical' ? 'URGENT' : 'Alert';
  return `${icon} AquaMaa · ${head} · ${AST.format(Date.now())} AST\n${alert.title}${alert.detail && kind !== 'cleared' ? `\n${alert.detail}` : ''}`;
}

function startNotifier(log = console) {
  const cfgEnv = settings();
  if (!cfgEnv.token) return null;   // chats come from TELEGRAM_CHAT_ID and/or /subscribe
  const st = { rows: [], ids: new Set(), maxId: 0, active: null, busy: false, timer: null, failures: 0 };

  function merge(rows) {
    for (const r of rows) {
      if (!r || r.id == null || st.ids.has(r.id)) continue;
      st.ids.add(r.id); st.rows.push(r); if (r.id > st.maxId) st.maxId = r.id;
    }
    const cut = Date.now() - Math.max(WINDOW_MS, getSensorConfig().operations.deviceLookbackHours * 3600000);
    if (st.rows.length > 20000 || (st.rows[0] && Date.parse(st.rows[0].created_at) < cut)) {
      st.rows = st.rows.filter((r) => Date.parse(r.created_at) >= cut);
      st.ids = new Set(st.rows.map((r) => r.id));
    }
  }

  async function tick() {
    if (st.busy) return;
    st.busy = true;
    try {
      const cfg = getSensorConfig(), now = Date.now();
      if (st.active === null && !st.rows.length) {
        const since = now - cfg.operations.deviceLookbackHours * 3600000;
        merge((await data.fetchHistoryRows({ ...cfg, ranges: { ...cfg.ranges, w: { ms: now - since } } }, now, 'w')).rows.reverse());
      } else {
        merge(await data.fetchRowsAfter(st.maxId, now - cfg.operations.deviceLookbackHours * 3600000));
      }
      const newestFirst = st.rows.slice().reverse();
      const a = S.analyze(newestFirst, newestFirst, cfg, now, '24h', null);
      st.last = a;
      const current = new Map(a.alerts.map((x) => [x.id, x]));
      if (st.active === null) {                       // first poll: remember, announce nothing
        st.active = current;
        const n = recipients().length;
        log.log(`Telegram alerts: on (${n} chat${n === 1 ? '' : 's'}; more with /subscribe), ${current.size} existing alert(s) not re-sent`);
        return;
      }
      const out = [];
      for (const [id, x] of current) if (!st.active.has(id)) out.push(format(x, 'alert'));
      for (const [id, x] of st.active) if (!current.has(id) && x.type !== 'deviation') out.push(format(x, 'cleared'));
      st.active = current;
      for (const text of out.slice(0, MAX_PER_POLL)) await broadcast(cfgEnv.token, text, log);
      if (out.length > MAX_PER_POLL) await broadcast(cfgEnv.token, `…and ${out.length - MAX_PER_POLL} more alerts: see the dashboard.`, log);
      st.failures = 0;
    } catch (e) {
      if (++st.failures <= 3 || st.failures % 30 === 0) log.error(`Telegram alerts: ${e.message}`);
    } finally {
      st.busy = false;
    }
  }

  tick();
  st.timer = setInterval(tick, cfgEnv.pollMs);
  if (st.timer.unref) st.timer.unref();
  const replies = startReplies(cfgEnv.token, () => st.last, log);
  return { stop: () => { clearInterval(st.timer); replies.stop(); }, tick, state: st };
}

/* ---------- replies: the bot answers messages ----------
 *   /start, /help      what the bot does
 *   /now, or a question about the current readings   instant card from the live analysis
 *   anything else      asked to the AquaMaa AI (server/assistant-model.js), as on the website chat;
 *                      if the AI is not running, the readings card is sent instead, saying so */
const WELCOME = '💧 صوت البئر · The Voice of the Well\n\nYour well can\'t speak, so AquaMaa speaks for it. I send an alert here the moment the water changes.\n\n'
  + '• /subscribe: get an alert here the moment the water changes\n'
  + '• /now: the latest readings, what the water is good for, and the water quality index\n'
  + '• /unsubscribe: stop the alerts\n'
  + '• Or ask me anything about your water, in English or Arabic.\n\n'
  + 'أرسل /subscribe لتصلك التنبيهات، و/now لآخر القراءات، أو اسألني عن ماء بئرك.';
const READINGS_Q = /\b(now|readings?|current|latest|status|salinity|tds|ph|temperature)\b|الآن|الحين|قراء|ملوح|حموض|حرار/i;

const fmtN = (v, d) => (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}
function readingsCard(a) {
  if (!a || !a.wells.length) return 'No sensor readings yet. Check that the sensor is powered and on Wi-Fi.';
  const lines = [];
  for (const w of a.wells) {
    const f = w.fresh, at = Math.max(0, ...Object.values(f).filter(Boolean).map((x) => x.at));
    lines.push(`💧 ${w.label} · ${w.online ? '🟢 live' : '⚪ offline'} · ${at ? ago(at) : '—'}`);
    lines.push(`Salinity (TDS): ${fmtN(f.tds_ppm && f.tds_ppm.value, 0)} ppm`);
    lines.push(`pH: ${fmtN(f.ph && f.ph.value, 2)}  ·  Temperature: ${fmtN(f.temperature && f.temperature.value, 1)} °C`);
    lines.push(`Turbidity (raw, uncalibrated): ${fmtN(f.turbidity_raw && f.turbidity_raw.value, 0)}`);
    const card = (a.waterCard || []).find((c) => c.well === w.label);
    if (card && card.uses.length) {
      const ok = card.uses.filter((u) => u.ok).map((u) => u.short), no = card.uses.filter((u) => !u.ok).map((u) => u.short);
      if (ok.length) lines.push(`✅ Good for: ${ok.join(', ')}`);
      if (no.length) lines.push(`❌ Not for: ${no.join(', ')}`);
    }
    const q = a.wqi && a.wqi.wells.find((x) => x.well === w.label);
    if (q) lines.push(`Water quality index: ${Math.round(q.wqi)}/100 (${q.category}, CCME)`);
    lines.push('');
  }
  const n = a.alerts.length;
  lines.push(n ? `⚠️ ${n} active alert${n === 1 ? '' : 's'}: ${a.alerts.slice(0, 3).map((x) => x.title.split('.')[0]).join('; ')}` : '✅ No active alerts');
  if (!a.wells.some((w) => w.online)) lines.push('Sensors are offline: these are the last known values.');
  return lines.join('\n');
}

function startReplies(token, latest, log) {
  let offset = 0, stopped = false;
  const reply = (chat, text) => send(token, chat, text).catch((e) => log.error(`Telegram reply: ${e.message}`));
  async function askAI(text) {
    const { buildGrounding, validate } = require('./assistant');
    const model = require('./assistant-model');
    const v = validate({ message: text.slice(0, 1000), page: 'dashboard', context: { dateRange: '24h' } }, { needMessage: true });
    const out = await model.generate({ message: v.message, page: v.page, grounding: await buildGrounding(v), role: 'farmer' });
    return String((out && out.text) || '').trim();
  }
  async function handle(msg) {
    const chat = msg.chat.id, text = String(msg.text || '').trim();
    if (!text) return;
    if (/^\/(start|help)\b/i.test(text)) return reply(chat, WELCOME);
    if (/^\/subscribe\b/i.test(text) || /^(subscribe|اشتراك|اشترك)$/i.test(text)) {
      const who = [msg.chat.title, msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') || msg.chat.username || '';
      const isNew = subscribe(chat, who);
      return reply(chat, `${isNew ? '🔔 Subscribed!' : '🔔 You are already subscribed.'} You'll get an alert here the moment the well water changes.\nتم الاشتراك: ستصلك التنبيهات هنا فور تغيّر ماء البئر.\n\nSend /unsubscribe to stop.\n\n${readingsCard(latest())}`);
    }
    if (/^\/unsubscribe\b/i.test(text)) {
      const removed = unsubscribe(chat);
      const fixed = settings().chats.includes(String(chat));
      return reply(chat, fixed ? 'This chat is set to receive alerts in the server settings (.env), so it stays subscribed.'
        : removed ? '🔕 Unsubscribed. You will no longer get alerts. Send /subscribe to start again.' : 'You were not subscribed. Send /subscribe to get alerts.');
    }
    if (/^\/now\b/i.test(text) || (READINGS_Q.test(text) && text.length < 80)) return reply(chat, readingsCard(latest()));
    reply(chat, '⏳ Asking AquaMaa… (10-60 s)');
    try {
      const answer = await askAI(text);
      reply(chat, answer || readingsCard(latest()));
    } catch (e) {
      reply(chat, `The AquaMaa AI is not available right now (${e.message}). Here are the latest readings:\n\n${readingsCard(latest())}`);
    }
  }
  (async function loop() {
    let fails = 0;
    while (!stopped) {
      try {
        const r = await fetch(`${API}/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=%5B%22message%22%5D`, { signal: AbortSignal.timeout(35000) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.description || `status ${r.status}`);
        for (const u of d.result) { offset = u.update_id + 1; if (u.message) handle(u.message); }
        fails = 0;
      } catch (e) {
        if (++fails <= 3 || fails % 20 === 0) log.error(`Telegram replies: ${e.message}`);
        await new Promise((res) => setTimeout(res, Math.min(30000, 2000 * fails)));
      }
    }
  })();
  return { stop: () => { stopped = true; } };
}

module.exports = { startNotifier, format, readingsCard, subscribe, unsubscribe, subscribers, recipients };

/* CLI: --chat-id lists the chats that have written to the bot; --test sends a test message. */
if (require.main === module) {
  try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* optional */ }
  const { token, chats } = settings();
  if (!token) { console.error('Set TELEGRAM_BOT_TOKEN in .env first (from @BotFather).'); process.exit(1); }
  (async () => {
    if (process.argv.includes('--chat-id')) {
      const r = await (await fetch(`${API}/bot${token}/getUpdates`)).json();
      const seen = new Map();
      for (const u of r.result || []) {
        const c = (u.message || u.channel_post || u.my_chat_member || {}).chat;
        if (c) seen.set(c.id, c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '');
      }
      if (!seen.size) console.log('No chats yet: send any message to the bot in Telegram, then run this again.');
      for (const [id, name] of seen) console.log(`TELEGRAM_CHAT_ID=${id}    (${name})`);
      const subs = subscribers();
      console.log(`Subscribed with /subscribe: ${subs.length ? subs.map((r) => `${r.chat_id} (${r.name || ''})`).join(', ') : 'none'}`);
    } else if (process.argv.includes('--test')) {
      const to = recipients();
      if (!to.length) { console.error('No chats yet: set TELEGRAM_CHAT_ID in .env, or send /subscribe to the bot while the website runs.'); process.exit(1); }
      for (const c of to) await send(token, c, '✅ AquaMaa alerts are connected to this chat.');
      console.log(`Test message sent to ${to.length} chat(s).`);
    } else {
      console.log('Usage: node server/notifier.js --chat-id | --test');
    }
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
