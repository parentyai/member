'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: admin app accepts hash deep-link and keeps actor/trace fetch wrapper contract', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('function resolvePaneFromLocation()'));
  assert.ok(src.includes('currentUrl.hash'));
  assert.ok(src.includes("globalThis.addEventListener('hashchange'"));

  assert.ok(src.includes("const OPS_ACTOR_HEADERS = { 'x-actor': 'admin_app' };"));
  assert.ok(src.includes("const TRACE_HEADER_NAME = 'x-trace-id';"));
  assert.ok(src.includes('function buildHeaders(extra, traceId)'));
  assert.ok(src.includes('Object.assign({}, extra || {}, OPS_ACTOR_HEADERS, { [TRACE_HEADER_NAME]: trace })'));

  assert.ok(src.includes('const headers = Object.assign({}, opts.headers || {}, buildHeaders({}, traceId));'));
  assert.ok(src.includes('const res = await fetch(url, { method, headers, body });'));
});
