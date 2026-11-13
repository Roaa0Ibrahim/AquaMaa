'use strict';
/*
 * AI MODEL INTEGRATION POINT: connected to the AquaMaa agent (Roaa's agent service, python api.py).
 *
 * generate() receives what server/assistant.js assembles:
 *   message    the user's question
 *   page       the page id the user is looking at
 *   grounding  live, read-only sensor data and thresholds (buildGrounding); passed on to the agent, which uses the
 *              latest readings as facts and treats grounding.clientContext as data, not instructions
 *   role       the signed-in user's role; the agent picks its answer style from it (officer roles get the officer
 *              persona, a farmer account gets the farmer persona)
 *
 * The agent runs on the same computer at AQUAMAA_AGENT_URL (default http://127.0.0.1:8000). If AQUAMAA_API_KEY is set,
 * it is sent as X-AquaMaa-Key. Answers take 10-60 seconds; the agent answers one question at a time.
 * Returns { text }.
 */
const AGENT_URL = (process.env.AQUAMAA_AGENT_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_KEY = process.env.AQUAMAA_API_KEY || '';
const TIMEOUT_MS = Number(process.env.AQUAMAA_AGENT_TIMEOUT_MS) || 180000;

function notConnected(message) {
  const err = new Error(message);
  err.code = 'assistant_not_connected';
  return err;
}

async function generate({ message, page, grounding, role }) {
  const headers = { 'content-type': 'application/json' };
  if (API_KEY) headers['X-AquaMaa-Key'] = API_KEY;
  let res;
  try {
    res = await fetch(`${AGENT_URL}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: message, role: role || null, context: { page }, grounding }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
    throw notConnected(timedOut
      ? 'The AquaMaa AI is taking too long. Please try again in a minute.'
      : 'The AquaMaa AI is offline. Start it with "python api.py" in the AquaMaa folder.');
  }
  if (!res.ok) throw notConnected(`The AquaMaa AI could not answer this question (status ${res.status}).`);
  const answer = await res.json();
  return { text: String(answer.answer || '') };
}

module.exports = { generate };
