/* AquaMaa chat box: speech in and out, using the browser's own speech services (Chrome and Edge).
 * Plugs into the hooks assistant.js leaves for this:
 *   onListeningStart / onListeningStop -> speech recognition in the chat's own language setting (the ع / EN button
 *                                         next to the microphone; Arabic by default), never the page's language.
 *                                         The words go into the question box; AquaMaa fixes misheard words
 *                                         (POST /clean on the agent service), then you check them and send.
 *   onAssistantReply                   -> when the question was spoken, the answer is read aloud in its language.
 * Speaking stops when you press the microphone, close or minimise the chat, or leave the page.
 * Recognition in Chrome sends the audio to Google's speech service, so it needs internet. Nothing is stored here
 * except the chosen language, in this browser.
 */
(function () {
  'use strict';
  const A = window.AquaMaaAssistant;
  if (!A || !A.hooks) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const CLEAN_URL = 'http://127.0.0.1:8000/clean';   // the AquaMaa agent service on this laptop
  const LANGS = { ar: { code: 'ar-QA', label: 'ع', title: 'Listening in Arabic. Click for English' },
                  en: { code: 'en-US', label: 'EN', title: 'Listening in English. Click for Arabic' } };
  let lang = 'ar';
  try { lang = localStorage.getItem('aq_speech_lang') === 'en' ? 'en' : 'ar'; } catch (e) { /* default Arabic */ }
  let rec = null;
  let heard = '';
  let lastWasSpoken = false;

  function stopSpeaking() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }

  // Stop speaking when the chat closes or is minimised (assistant.js removes the aq-open class from <body>)
  new MutationObserver(() => { if (!document.body.classList.contains('aq-open')) stopSpeaking(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pagehide', stopSpeaking);
  window.addEventListener('beforeunload', stopSpeaking);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopSpeaking(); });
  stopSpeaking();                                      // anything left speaking from an earlier page stops now

  // The ع / EN button next to the microphone: the language to listen in
  function addLanguageButton() {
    const mic = document.querySelector('.aq-round.mic');
    if (!mic || document.querySelector('.aq-speech-lang')) return !!mic;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aq-round aq-speech-lang';
    b.style.cssText = 'font-weight:700;font-size:14px;min-width:36px';
    const show = () => { b.textContent = LANGS[lang].label; b.title = LANGS[lang].title; b.setAttribute('aria-label', LANGS[lang].title); };
    b.addEventListener('click', () => {
      lang = lang === 'ar' ? 'en' : 'ar';
      try { localStorage.setItem('aq_speech_lang', lang); } catch (e) { /* not remembered */ }
      show();
    });
    show();
    mic.insertAdjacentElement('afterend', b);
    return true;
  }
  if (!addLanguageButton()) {
    const wait = new MutationObserver(() => { if (addLanguageButton()) wait.disconnect(); });
    wait.observe(document.body, { childList: true, subtree: true });
  }

  // Arabic questions are also recorded and sent to Fanar's speech recognition (POST /transcribe), which knows Gulf
  // dialect better than the browser's: «شكثر الاملاح في بيري؟» came out of the browser as «إيش كثر الكبيري؟».
  // The browser's text shows first; Fanar's replaces it when it arrives. If Fanar fails, the browser's text stays.
  const TRANSCRIBE_URL = 'http://127.0.0.1:8000/transcribe';
  let recorder = null;
  let chunks = [];

  function startRecording() {
    recorder = null; chunks = [];
    if (lang !== 'ar' || !window.MediaRecorder || !navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = () => stream.getTracks().forEach((t) => t.stop());
      r.start();
      recorder = r;
      if (!rec) stopRecording();                      // recognition already ended while the microphone opened
    }).catch((e) => console.warn('Recording for Fanar:', e));
  }

  // The recording as a 16 kHz mono WAV, or null
  function stopRecording() {
    const r = recorder;
    recorder = null;
    if (!r || r.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      const done = r.onstop;
      r.onstop = () => { done(); resolve(chunks.length ? toWav(new Blob(chunks, { type: r.mimeType })) : null); };
      r.stop();
    });
  }

  async function toWav(blob) {
    try {
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      ctx.close();
      const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
      const src = off.createBufferSource();
      src.buffer = decoded; src.connect(off.destination); src.start();
      const pcm = (await off.startRendering()).getChannelData(0);
      const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
      const text = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
      text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
      for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
      return new Blob([view], { type: 'audio/wav' });
    } catch (e) { console.warn('Recording for Fanar:', e); return null; }
  }

  if (Recognition) {
    A.hooks.onListeningStart = function () {
      stopSpeaking();                                  // never talk over the person speaking
      heard = '';
      lastWasSpoken = true;
      startRecording();
      rec = new Recognition();
      rec.lang = LANGS[lang].code;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = function (e) {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      };
      rec.onerror = function (e) { console.warn('Speech recognition:', e.error); };
      rec.onend = async function () {
        const text = heard.trim();
        rec = null;
        const box = document.querySelector('input[aria-label="Message"]');
        const put = (t) => {
          if (box) { box.value = t; box.focus(); box.setSelectionRange(t.length, t.length); }
          else A.submitTranscript(t);
        };
        const cleanBrowserText = () => {
          if (!text) return;
          fetch(CLEAN_URL, { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }), signal: AbortSignal.timeout(8000) })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => { if (j && j.changed && box && box.value === text) put(j.text); })
            .catch(() => { /* the agent service is unreachable: keep what was heard */ });
        };
        if (text) put(text);
        const wav = await stopRecording();
        if (!wav) { cleanBrowserText(); return; }
        if (box && !text) box.placeholder = '…';
        try {
          const r = await fetch(TRANSCRIBE_URL, { method: 'POST', headers: { 'content-type': 'audio/wav' },
            body: wav, signal: AbortSignal.timeout(20000) });
          const j = r.ok ? await r.json() : null;
          if (j && j.text && (!box || box.value === text || !box.value)) put(j.text);
          else if (!j) cleanBrowserText();
        } catch (e) { cleanBrowserText(); }
      };
      try { rec.start(); } catch (e) { console.error(e); }
    };
    A.hooks.onListeningStop = function () { if (rec) try { rec.stop(); } catch (e) { /* already stopped */ } };
  }

  function speakable(text) {
    return String(text || '')
      .split('\n\nKey figures:')[0].split('\n\nأرقام رئيسية:')[0]
      .split('\n\nNote on sources:')[0].split('\n\nملاحظة عن المصادر:')[0]
      .replace(/\[[^\]]*\]/g, '')
      .replace(/mg\/L/g, ' milligrams per litre')
      .replace(/\bppm\b/g, ' parts per million')
      .replace(/\s+/g, ' ')
      .trim();
  }

  A.hooks.onAssistantReply = function (text) {
    if (!lastWasSpoken || !window.speechSynthesis) return;   // read aloud only answers to spoken questions
    lastWasSpoken = false;
    if (!document.body.classList.contains('aq-open')) return;  // the chat was closed meanwhile
    const say = speakable(text);
    if (!say) return;
    const u = new SpeechSynthesisUtterance(say);
    u.lang = /[؀-ۿ]/.test(say) ? 'ar-SA' : 'en-US';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.slice(0, 2) === u.lang.slice(0, 2));
    if (voice) u.voice = voice;
    stopSpeaking();
    window.speechSynthesis.speak(u);
  };
})();
