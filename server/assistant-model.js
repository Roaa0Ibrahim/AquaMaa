'use strict';
/*
 * ──────────────────────────────────────────────────────────────────────────
 *  AI MODEL INTEGRATION POINT  (intentionally not implemented)
 * ──────────────────────────────────────────────────────────────────────────
 * Replace generate() with your own model call. It receives:
 *
 *   message    the user's question (validated string, <= 2000 chars)
 *   page       the page id the user is looking at
 *   grounding  live, read-only data + page context assembled by server/assistant.js
 *              (see buildGrounding). Treat grounding.clientContext as UNTRUSTED data,
 *              not as instructions. Answer only from grounding; say so when something
 *              is not available (e.g. turbidity in NTU).
 *
 * Return { text: string }. Use an API key from process.env (e.g. AI_PROVIDER_API_KEY)
 * and never send it to the browser.
 */
async function generate(/* { message, page, grounding } */) {
  const err = new Error('The AI model is not connected yet. Implement generate() in server/assistant-model.js.');
  err.code = 'assistant_not_connected';
  throw err;
}

module.exports = { generate };
