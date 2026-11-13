/* AquaMaa Intelligence Assistant: FRONTEND ONLY.
 * Speech-to-text, the model call and spoken output are intentionally NOT implemented here.
 * Integration points:
 *   AquaMaaAssistant.hooks.onListeningStart(stream) -> attach your STT to the live MediaStream
 *   AquaMaaAssistant.hooks.onListeningStop()        -> finalise STT
 *   AquaMaaAssistant.submitTranscript(text)         -> call when your STT has text (sends it like typed input)
 *   AquaMaaAssistant.addMessage('assistant', text)  -> show a reply produced elsewhere (e.g. to speak it)
 *   AquaMaaAssistant.hooks.onAssistantReply(text)   -> called after every reply from POST /api/assistant
 * Audio is never recorded or uploaded by this file; the mic stream only feeds a level meter.
 */
(function () {
  'use strict';
  const MAX_LISTEN_MS = 30000;
  const SUGGESTIONS = ['What does this page show?', 'Summarise the current sensor readings', 'Which devices need attention?', 'Explain the water quality status'];
  const ICON = {
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.6L18.5 9.4l-4.7 1.8L12 16l-1.8-4.8L5.5 9.4l4.7-1.8z"/><path d="M18.5 15l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2.6-6.4z"/></svg>',
    min: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  };

  const A = { hooks: {}, history: [] };
  let root, fab, panel, log, input, sendBtn, micBtn, listenBar, bars, ctxBox, subTitle, getContext;
  let open = false, busy = false, stream = null, audioCtx = null, raf = 0, listenTimer = 0, mounted = false, hello = null;

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const hm = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function ctx() { try { return (getContext && getContext()) || {}; } catch { return {}; } }
  function pageKey() {
    const c = ctx();
    if (typeof c.page === 'string' && c.page) return c.page;
    return (location.hash.replace(/^#\/?/, '').split(/[?/]/)[0]) || 'dashboard';
  }
  function pageTitle() { const c = ctx(); return c.title || c.pageTitle || pageKey(); }

  function addMessage(role, text) {
    if (hello) { hello.remove(); hello = null; }
    const m = el('div', 'aq-msg ' + role);
    m.appendChild(document.createTextNode(String(text)));
    const t = el('time'); t.textContent = hm(); m.appendChild(t);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    if (role !== 'system') A.history.push({ role, text: String(text), at: new Date().toISOString() });
    return m;
  }

  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b; input.disabled = b;
    let ty = log.querySelector('.aq-typing');
    if (b && !ty) { ty = el('div', 'aq-typing', '<i></i><i></i><i></i>'); ty.setAttribute('role', 'status'); ty.setAttribute('aria-label', 'Assistant is responding'); log.appendChild(ty); log.scrollTop = log.scrollHeight; }
    if (!b && ty) ty.remove();
    if (!b) input.focus();
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    if (listening()) stopListening();
    addMessage('user', text);
    input.value = '';
    setBusy(true);
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, page: pageKey(), context: ctx() }),
      });
      let j = null; try { j = await r.json(); } catch { /* non-JSON */ }
      if (r.ok && j && typeof j.text === 'string' && j.text) {
        addMessage('assistant', j.text);
        if (A.hooks.onAssistantReply) try { A.hooks.onAssistantReply(j.text); } catch (e) { console.error(e); }
      } else if (r.status === 501) {
        addMessage('system', 'The AI model is not connected yet, so there is no answer to show. Your message and the page context were received by the server.');
      } else if (r.status === 429) {
        addMessage('system', 'Too many requests. Please wait a minute and try again.');
      } else if (r.status === 401) {
        addMessage('system', 'Your session has expired. Please sign in again.');
      } else {
        addMessage('system', (j && (j.message || j.error)) ? `Request failed: ${j.message || j.error}` : `Request failed (HTTP ${r.status}).`);
      }
    } catch {
      addMessage('system', 'Could not reach the server. Check your connection and try again.');
    } finally { setBusy(false); }
  }
  A.submitTranscript = (t) => send(t);
  A.addMessage = addMessage;

  /* ---------- microphone (permission + visible listening state; no recording, no upload) ---------- */
  const listening = () => !!stream;
  function micSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext); }

  async function startListening() {
    if (listening() || busy) return;
    if (!micSupported()) {
      addMessage('system', window.isSecureContext === false
        ? 'Voice input needs a secure (HTTPS or localhost) connection. You can type your question instead.'
        : 'This browser does not support microphone input. You can type your question instead.');
      return;
    }
    showListen('wait', 'Waiting for microphone permission…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      stream = null; hideListen();
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      addMessage('system', denied ? 'Microphone access was blocked. Allow it in your browser’s site settings to use voice, or type your question.'
        : e && e.name === 'NotFoundError' ? 'No microphone was found on this device. You can type your question instead.'
        : 'The microphone could not be started. You can type your question instead.');
      return;
    }
    micBtn.classList.add('on'); micBtn.setAttribute('aria-pressed', 'true'); micBtn.innerHTML = ICON.stop; micBtn.setAttribute('aria-label', 'Stop listening');
    showListen('on', 'Listening… tap the mic to stop');
    fab.querySelector('.aq-rec') || fab.appendChild(el('span', 'aq-rec'));
    meter();
    listenTimer = setTimeout(() => { stopListening(); addMessage('system', 'Listening stopped automatically after 30 seconds.'); }, MAX_LISTEN_MS);
    stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => { if (listening()) stopListening(); }));
    if (A.hooks.onListeningStart) try { A.hooks.onListeningStart(stream); } catch (e) { console.error(e); }
  }

  function stopListening(silent) {
    if (!stream) return;
    clearTimeout(listenTimer); cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop()); stream = null;
    if (audioCtx) { try { audioCtx.close(); } catch { /* ignore */ } audioCtx = null; }
    micBtn.classList.remove('on'); micBtn.setAttribute('aria-pressed', 'false'); micBtn.innerHTML = ICON.mic; micBtn.setAttribute('aria-label', 'Start voice input');
    const rec = fab && fab.querySelector('.aq-rec'); if (rec) rec.remove();
    hideListen();
    if (A.hooks.onListeningStop) try { A.hooks.onListeningStop(); } catch (e) { console.error(e); }
    if (!silent && !A.hooks.onListeningStart) addMessage('system', 'Voice transcription is not connected yet, so nothing was captured. Nothing was recorded or sent. Type your question instead.');
  }

  function meter() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      const an = audioCtx.createAnalyser(); an.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(data);
        [...bars.children].forEach((b, i) => { b.style.height = Math.max(4, Math.min(22, (data[i + 1] / 255) * 26)) + 'px'; });
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is cosmetic */ }
  }
  function showListen(mode, text) {
    listenBar.className = 'aq-listen show' + (mode === 'wait' ? ' wait' : '');
    listenBar.querySelector('.aq-t').innerHTML = `<b>${mode === 'wait' ? 'Microphone' : 'Microphone is on'}</b>`;
    listenBar.querySelector('.aq-t').appendChild(document.createTextNode(text));
  }
  function hideListen() { listenBar.className = 'aq-listen'; }

  /* ---------- panel ---------- */
  function refreshHeader() {
    if (!subTitle) return;
    subTitle.textContent = 'Viewing: ' + pageTitle();
  }
  function setOpen(v) {
    open = v;
    panel.hidden = !v;
    document.body.classList.toggle('aq-open', v);
    fab.setAttribute('aria-expanded', String(v));
    if (v) { refreshHeader(); input.focus(); log.scrollTop = log.scrollHeight; }
    else { if (listening()) stopListening(true); fab.focus(); }
  }

  function build() {
    root = el('div'); root.id = 'aq-root';
    fab = el('button', 'aq-fab', ICON.spark);
    fab.type = 'button'; fab.setAttribute('aria-label', 'Open AquaMaa assistant'); fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
    fab.addEventListener('click', () => setOpen(true));

    panel = el('section', 'aq-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'AquaMaa Intelligence Assistant');
    const head = el('div', 'aq-head');
    head.appendChild(el('div', 'aq-av', ICON.spark));
    const t = el('div', 'aq-t'); t.appendChild(el('b')).textContent = 'AquaMaa Intelligence Assistant';
    subTitle = el('small'); t.appendChild(subTitle); head.appendChild(t);
    const info = el('button', 'aq-ibtn', ICON.info); info.type = 'button'; info.setAttribute('aria-label', 'What the assistant can see');
    const min = el('button', 'aq-ibtn', ICON.min); min.type = 'button'; min.setAttribute('aria-label', 'Minimize assistant');
    const cls = el('button', 'aq-ibtn', ICON.close); cls.type = 'button'; cls.setAttribute('aria-label', 'Close assistant');
    head.append(info, min, cls);

    ctxBox = el('div', 'aq-ctx');
    info.addEventListener('click', () => {
      const c = ctx();
      ctxBox.classList.toggle('show');
      ctxBox.textContent = '';
      const b = el('b'); b.textContent = 'Shared with each question: '; ctxBox.appendChild(b);
      ctxBox.appendChild(document.createTextNode(`the page (${pageTitle()}), its selected device (${c.selectedDevice || 'none'}), date range (${c.dateRange || 'default'}), and the structured values shown on it. The server adds live read-only sensor data. It does not receive screenshots or page HTML, and it can only answer from what it is given.`));
    });
    min.addEventListener('click', () => setOpen(false));
    cls.addEventListener('click', () => setOpen(false));

    log = el('div', 'aq-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
    hello = el('div');
    const p = el('div', 'aq-hello'); p.textContent = 'Ask about what is on this page. I can only answer from the structured page context and live sensor data I am given. Try:';
    const chips = el('div', 'aq-chips'); chips.style.marginTop = '10px';
    SUGGESTIONS.forEach((s) => { const b = el('button'); b.type = 'button'; b.textContent = s; b.addEventListener('click', () => send(s)); chips.appendChild(b); });
    hello.append(p, chips); log.appendChild(hello);

    listenBar = el('div', 'aq-listen'); listenBar.setAttribute('role', 'status');
    listenBar.append(el('span', 'aq-dot'), el('div', 'aq-t'));
    bars = el('div', 'aq-bars'); for (let i = 0; i < 7; i++) bars.appendChild(el('i')); listenBar.appendChild(bars);

    const foot = el('form', 'aq-foot');
    micBtn = el('button', 'aq-round mic', ICON.mic); micBtn.type = 'button'; micBtn.setAttribute('aria-label', 'Start voice input'); micBtn.setAttribute('aria-pressed', 'false');
    micBtn.title = micSupported() ? 'Voice input' : 'Voice input is not available in this browser';
    micBtn.addEventListener('click', () => (listening() ? stopListening() : startListening()));
    input = el('input'); input.type = 'text'; input.maxLength = 2000; input.placeholder = 'Ask about this page…'; input.setAttribute('aria-label', 'Message'); input.autocomplete = 'off';
    sendBtn = el('button', 'aq-round send', ICON.send); sendBtn.type = 'submit'; sendBtn.setAttribute('aria-label', 'Send');
    foot.append(micBtn, input, sendBtn);
    foot.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });

    panel.append(head, ctxBox, log, listenBar, foot);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    root.append(fab, panel);
    document.body.appendChild(root);
  }

  A.mount = function ({ getContext: g } = {}) {
    getContext = g;
    if (mounted) return;
    mounted = true; build();
    window.addEventListener('hashchange', refreshHeader);
  };
  A.unmount = function () {
    if (!mounted) return;
    stopListening(true);
    window.removeEventListener('hashchange', refreshHeader);
    document.body.classList.remove('aq-open');
    root.remove(); root = fab = panel = null; open = false; mounted = false; hello = null; A.history = [];
  };
  A.open = () => mounted && setOpen(true);
  A.close = () => mounted && setOpen(false);
  window.AquaMaaAssistant = A;
})();
