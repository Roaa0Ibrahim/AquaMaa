'use strict';
// AquaMaa chat panel: a floating button that opens a question box. Text question in, text answer out.
// Self-contained: it talks only to /api/ask (server/chat.js) and shows itself once the user is signed in.
(function () {
  const L = {
    en: { open: 'Ask AquaMaa', title: 'Ask AquaMaa', sub: 'Groundwater assistant for Qatar', place: 'Ask about groundwater in Qatar…',
      send: 'Send', close: 'Close', thinking: 'Checking the sources', sources: 'Sources', offline: 'The assistant is offline right now.',
      hello: 'Ask a question about Qatar’s groundwater: supply, quality, extraction or the dashboard figures. Each question is answered on its own, with its sources.',
      outScope: 'Outside AquaMaa’s sources: general answer' },
    ar: { open: 'اسأل أكوا ماء', title: 'اسأل أكوا ماء', sub: 'مساعد المياه الجوفية في قطر', place: 'اسأل عن المياه الجوفية في قطر…',
      send: 'إرسال', close: 'إغلاق', thinking: 'جارٍ مراجعة المصادر', sources: 'المصادر', offline: 'المساعد غير متاح الآن.',
      hello: 'اطرح سؤالاً عن المياه الجوفية في قطر: الإمداد أو الجودة أو الاستخراج أو أرقام لوحة المعلومات. يُجاب عن كل سؤال وحده مع مصادره.',
      outScope: 'خارج مصادر أكوا ماء: إجابة عامة' },
  };
  const tr = (k) => (L[document.documentElement.lang === 'ar' ? 'ar' : 'en'])[k];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CITE = /\[([^\]\n]{2,120})\]/g;

  let root, log, form, input, sendBtn, busy = false;

  // Answer text -> safe HTML: paragraphs, "- " lists, and [source] labels shown as small tags.
  function render(text) {
    const blocks = esc(text).split(/\n{2,}/);
    return blocks.map((b) => {
      const lines = b.split('\n');
      const withCites = (s) => s.replace(CITE, (m, label) => `<span class="aqc-cite${/^general knowledge$/i.test(label.trim()) ? ' gen' : ''}">${label}</span>`);
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${withCites(l.replace(/^\s*[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(withCites).join('<br>')}</p>`;
    }).join('');
  }

  function add(kind, html) {
    const m = document.createElement('div');
    m.className = `aqc-msg ${kind}`;
    m.setAttribute('dir', 'auto');
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  async function ask(question) {
    busy = true; sendBtn.disabled = true; input.disabled = true;
    add('user', esc(question));
    const wait = add('bot pending', `<span class="aqc-dots"><i></i><i></i><i></i></span> ${esc(tr('thinking'))} <span class="aqc-secs">0 s</span>`);
    const started = Date.now();
    const timer = setInterval(() => { wait.querySelector('.aqc-secs').textContent = `${Math.round((Date.now() - started) / 1000)} s`; }, 1000);
    try {
      const res = await fetch('/api/ask', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      let body = null; try { body = await res.json(); } catch { /* no body */ }
      if (res.status === 401) { wait.className = 'aqc-msg bot err'; wait.textContent = 'Please sign in again.'; return; }
      if (!res.ok || !body) { wait.className = 'aqc-msg bot err'; wait.textContent = (body && body.error) || `Request failed (${res.status})`; return; }
      wait.className = `aqc-msg bot${body.error ? ' err' : ''}`;
      const tag = body.in_scope ? '' : `<div class="aqc-tag">${esc(tr('outScope'))}</div>`;
      const src = body.sources.length
        ? `<details class="aqc-src"><summary>${esc(tr('sources'))} (${body.sources.length})</summary><ul>${body.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></details>`
        : '';
      const secs = typeof body.seconds === 'number' ? `<div class="aqc-meta">${body.seconds.toFixed(0)} s</div>` : '';
      wait.innerHTML = tag + render(body.answer) + src + secs;
    } catch {
      wait.className = 'aqc-msg bot err'; wait.textContent = tr('offline');
    } finally {
      clearInterval(timer);
      busy = false; sendBtn.disabled = false; input.disabled = false; input.focus();
      log.scrollTop = log.scrollHeight;
    }
  }

  async function checkHealth() {
    try {
      const r = await (await fetch('/api/ask/health', { credentials: 'same-origin' })).json();
      root.classList.toggle('offline', !r.up);
    } catch { root.classList.add('offline'); }
  }

  function setOpen(open) {
    root.classList.toggle('open', open);
    if (open) { relabel(); checkHealth(); setTimeout(() => input.focus(), 50); }
  }

  // Labels follow the dashboard's language button (it changes <html lang>).
  function relabel() {
    root.querySelector('.aqc-fab span').textContent = tr('open');
    root.querySelector('.aqc-head b').textContent = tr('title');
    root.querySelector('.aqc-head small').textContent = tr('sub');
    root.querySelector('.aqc-x').setAttribute('aria-label', tr('close'));
    root.querySelector('.aqc-off').textContent = tr('offline');
    input.placeholder = tr('place');
    sendBtn.textContent = tr('send');
    const hello = root.querySelector('.aqc-msg.hello');
    if (hello) hello.textContent = tr('hello');
  }

  function mount() {
    root = document.createElement('div');
    root.className = 'aqc';
    root.hidden = true;
    root.innerHTML = `
      <button class="aqc-fab" type="button" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg><span></span></button>
      <section class="aqc-panel" role="dialog" aria-label="AquaMaa chat">
        <header class="aqc-head"><div><b></b><small></small></div><button class="aqc-x" type="button">×</button></header>
        <div class="aqc-off"></div>
        <div class="aqc-log" aria-live="polite"><div class="aqc-msg bot hello" dir="auto"></div></div>
        <form class="aqc-form"><textarea rows="2" maxlength="500" dir="auto" required></textarea><button type="submit"></button></form>
      </section>`;
    document.body.appendChild(root);
    log = root.querySelector('.aqc-log');
    form = root.querySelector('.aqc-form');
    input = form.querySelector('textarea');
    sendBtn = form.querySelector('button');
    relabel();

    const fab = root.querySelector('.aqc-fab');
    fab.addEventListener('click', () => { const o = !root.classList.contains('open'); setOpen(o); fab.setAttribute('aria-expanded', String(o)); });
    root.querySelector('.aqc-x').addEventListener('click', () => { setOpen(false); fab.setAttribute('aria-expanded', 'false'); fab.focus(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.replace(/\s+/g, ' ').trim();
      if (busy || q.length < 3) return;
      input.value = '';
      ask(q);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) setOpen(false); });

    // Show the chat only while the dashboard (#app) is visible, i.e. the user is signed in.
    const app = document.getElementById('app');
    const sync = () => { root.hidden = !app || app.hidden; if (root.hidden) setOpen(false); };
    if (app) new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
