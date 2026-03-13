'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase720: admin llm pane renders route+trace section and compat warning surface', () => {
  const html = read('apps/admin/app.html');
  const js = read('apps/admin/assets/admin_app.js');

  [
    'id="llm-route-api-source"',
    'id="llm-route-kind"',
    'id="llm-route-entry-type"',
    'id="llm-route-trace-id"',
    'id="llm-route-conversation-mode"',
    'id="llm-route-router-reason"',
    'id="llm-route-fallback-type"',
    'id="llm-route-decision-source"',
    'id="llm-route-bridge"',
    'id="llm-route-compat-reason"',
    'id="llm-route-compat-share"',
    'id="llm-route-warning"',
    'id="llm-route-trace-open"',
    'id="llm-route-trace-result"'
  ].forEach((marker) => {
    assert.ok(html.includes(marker), `missing llm route trace ui marker: ${marker}`);
  });

  assert.ok(js.includes('renderLlmRouteTraceInfo('));
  assert.ok(js.includes('openLlmRouteTraceFromRoutePanel('));
  assert.ok(js.includes('LLM_COMPAT_SHARE_THRESHOLD'));
  assert.ok(js.includes('WARNING: compat fallback で取得しました'));
  assert.ok(js.includes('ALERT: compatShareWindow='));
  assert.ok(js.includes("setTextContent('llm-route-fallback-type'"));
  assert.ok(js.includes("setTextContent('llm-route-decision-source'"));
  assert.ok(js.includes("setTextContent('llm-route-bridge'"));
  assert.ok(js.includes("setTextContent('llm-route-compat-reason'"));
  assert.ok(js.includes('compatFallbackReason'));
  assert.ok(js.includes('routeDecisionSource'));
  assert.ok(js.includes('sharedReadinessBridge'));
  assert.ok(js.includes("document.getElementById('llm-route-trace-open')?.addEventListener('click'"));
  assert.ok(js.includes('/api/admin/trace?traceId='));
  assert.ok(js.includes("source: ${source}"));
  assert.ok(js.includes('fetchJsonWithFallback('));
  assert.ok(js.includes('_apiSource'));
});
