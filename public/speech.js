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

  if (Recognition) {
    A.hooks.onListeningStart = function () {
      stopSpeaking();                                  // never talk over the person speaking
      heard = '';
      lastWasSpoken = true;
      rec = new Recognition();
      rec.lang = LANGS[lang].code;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = function (e) {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      };
      rec.onerror = function (e) { console.warn('Speech recognition:', e.error); };
      rec.onend = function () {
        const text = heard.trim();
        rec = null;
        if (!text) return;
        const box = document.querySelector('input[aria-label="Message"]');
        const put = (t) => {
          if (box) { box.value = t; box.focus(); box.setSelectionRange(t.length, t.length); }
          else A.submitTranscript(t);
        };
        put(text);
        fetch(CLEAN_URL, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }), signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => { if (j && j.changed && box && box.value === text) put(j.text); })
          .catch(() => { /* the agent service is unreachable: keep what was heard */ });
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
