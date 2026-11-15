'use strict';
// Telegram /subscribe: stored in a throwaway database, never the real one.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
process.env.AQUAMAA_DB = path.join(os.tmpdir(), `aquamaa-telegram-test-${process.pid}.db`);
process.env.TELEGRAM_CHAT_ID = '111';
const N = require('../server/notifier.js');

test('subscribe adds a chat once, unsubscribe removes it; .env chats are always included', () => {
  assert.deepEqual(N.recipients(), ['111']);
  assert.equal(N.subscribe(222, 'Salem'), true);
  assert.equal(N.subscribe(222, 'Salem'), false);          // already subscribed
  assert.deepEqual(N.recipients().sort(), ['111', '222']);
  assert.equal(N.subscribers()[0].name, 'Salem');
  assert.equal(N.unsubscribe(222), true);
  assert.equal(N.unsubscribe(222), false);
  assert.deepEqual(N.recipients(), ['111']);
  N.subscribe(111, 'Deema');                                // also in .env: listed once
  assert.deepEqual(N.recipients(), ['111']);
});
