'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase814: admin llm pane keeps one-click trace flow and adds cross-system trace join summary', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');

  assert.match(html, /id="llm-route-trace-open"/);
  assert.match(html, /id="llm-route-trace-result"/);
  assert.match(html, /id="llm-route-trace-join-summary"/);

  assert.match(appJs, /openLlmRouteTraceFromRoutePanel/);
  assert.match(appJs, /renderLlmTraceJoinSummary/);
  assert.match(appJs, /llm-route-trace-open/);
  assert.match(appJs, /llm-route-trace-join-summary/);
  assert.match(appJs, /openAuditFromSource\('llm', traceId, \{ historyMode: 'push' \}\)/);
});
