'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: trace refs stay operator-focused and preserve one-click audit handoff', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="quality-patrol-trace-note"'));
  assert.ok(html.includes('id="quality-patrol-trace-refs"'));
  assert.ok(js.includes('function openQualityPatrolTrace(traceId)'));
  assert.ok(js.includes("activatePane('audit', { historyMode: 'push' })"));
  assert.ok(js.includes('trace 参照は operator view で確認できます。'));
  assert.ok(js.includes('Open Trace'));
});
