'use strict';
// AquaMaa chat: forwards a signed-in user's question to the AquaMaa agent service (python api.py).
// The agent runs on the same computer at AQUAMAA_AGENT_URL (default http://127.0.0.1:8000).
// If AQUAMAA_API_KEY is set, it is sent as X-AquaMaa-Key (the agent checks it when it has one too).
const express = require('express');

const AGENT_URL = (process.env.AQUAMAA_AGENT_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_KEY = process.env.AQUAMAA_API_KEY || '';
const TIMEOUT_MS = Number(process.env.AQUAMAA_AGENT_TIMEOUT_MS) || 180000; // answers take 15-60 s; questions queue
const MIN_LEN = 3;
const MAX_LEN = 500;

module.exports = function chatRouter(requireAuth) {
  const router = express.Router();

  // Is the agent up? The chat panel uses this to show "assistant offline" before anyone types.
  router.get('/ask/health', requireAuth, async (req, res) => {
    try {
      const r = await fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(3000) });
      res.json({ up: r.ok });
    } catch {
      res.json({ up: false });
    }
  });

  router.post('/ask', requireAuth, async (req, res) => {
    const question = typeof req.body?.question === 'string' ? req.body.question.replace(/\s+/g, ' ').trim() : '';
    if (question.length < MIN_LEN || question.length > MAX_LEN) {
      return res.status(400).json({ error: `Please write a question of ${MIN_LEN} to ${MAX_LEN} characters.` });
    }
    const headers = { 'content-type': 'application/json' };
    if (API_KEY) headers['X-AquaMaa-Key'] = API_KEY;
    try {
      const r = await fetch(`${AGENT_URL}/ask`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, role: req.user.role }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) {
        console.error(`AquaMaa agent answered ${r.status}`);
        return res.status(502).json({ error: 'The assistant could not answer this question. Please try again.' });
      }
      const a = await r.json();
      res.json({
        answer: a.answer || '',
        sources: Array.isArray(a.sources) ? a.sources : [],
        key_figures: Array.isArray(a.key_figures) ? a.key_figures : [],
        in_scope: a.in_scope !== false,
        seconds: a.seconds,
        error: a.error || null,
      });
    } catch (e) {
      const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
      console.error(`AquaMaa agent ${timedOut ? 'timed out' : 'unreachable'}: ${e.message}`);
      res.status(timedOut ? 504 : 503).json({
        error: timedOut
          ? 'The assistant is taking too long. Please try again in a minute.'
          : 'The assistant is offline. Start it with "python api.py" in the AquaMaa folder.',
      });
    }
  });

  return router;
};
