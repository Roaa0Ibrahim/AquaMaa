/* AquaMaa chat box: speech in and out, using the browser's own speech services (Chrome and Edge).
 * Plugs into the hooks assistant.js leaves for this:
 *   onListeningStart / onListeningStop  -> speech recognition: Arabic (Qatar) when the site is in Arabic, else English;
 *                                          the recognised text is sent like a typed question
 *   onAssistantReply                    -> when the question was spoken, the answer is read aloud in its own language
 * Recognition in Chrome sends the audio to Google's speech service, so it needs internet. Nothing is stored here.
 */
(function () {
  'use strict';
  const A = window.AquaMaaAssistant;
  if (!A || !A.hooks) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const arabicPage = () => document.documentElement.lang === 'ar';
  let rec = null;
  let heard = '';
  let lastWasSpoken = false;

  if (Recognition) {
    A.hooks.onListeningStart = function () {
      heard = '';
      lastWasSpoken = true;
      rec = new Recognition();
      rec.lang = arabicPage() ? 'ar-QA' : 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = function (e) {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      };
      rec.onerror = function (e) { console.warn('Speech recognition:', e.error); };
      rec.onend = function () {
        const text = heard.trim();
        rec = null;
        if (text) A.submitTranscript(text);
      };
      try { rec.start(); } catch (e) { console.error(e); }
    };
    A.hooks.onListeningStop = function () { if (rec) try { rec.stop(); } catch (e) { /* already stopped */ } };
  }

  function speakable(text) {
    return String(text || '')
      .split('\n\nKey figures:')[0]
      .split('\n\nNote on sources:')[0]
      .replace(/\[[^\]]*\]/g, '')
      .replace(/mg\/L/g, ' milligrams per litre')
      .replace(/\bppm\b/g, ' parts per million')
      .replace(/\s+/g, ' ')
      .trim();
  }

  A.hooks.onAssistantReply = function (text) {
    if (!lastWasSpoken || !window.speechSynthesis) return;   // read aloud only answers to spoken questions
    lastWasSpoken = false;
    const say = speakable(text);
    if (!say) return;
    const u = new SpeechSynthesisUtterance(say);
    u.lang = /[؀-ۿ]/.test(say) ? 'ar-SA' : 'en-US';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.slice(0, 2) === u.lang.slice(0, 2));
    if (voice) u.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
})();
