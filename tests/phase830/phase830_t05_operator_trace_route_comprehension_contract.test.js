'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const read = (filePath) => fs.readFileSync(path.join(ROOT, filePath), 'utf8');

test('phase830: admin route panel preserves one-click flow while exposing route attribution fields', () => {
  const html = read('apps/admin/app.html');
  const js = read('apps/admin/assets/admin_app.js');

  [
    'id="llm-route-fallback-type"',
    'id="llm-route-decision-source"',
    'id="llm-route-bridge"',
    'id="llm-route-compat-reason"',
    'id="llm-route-trace-open"'
  ].forEach((marker) => {
    assert.ok(html.includes(marker), marker);
  });

  assert.ok(js.includes('openLlmRouteTraceFromRoutePanel('));
  assert.ok(js.includes("setTextContent('llm-route-fallback-type'"));
  assert.ok(js.includes("setTextContent('llm-route-decision-source'"));
  assert.ok(js.includes("setTextContent('llm-route-bridge'"));
  assert.ok(js.includes("setTextContent('llm-route-compat-reason'"));
  assert.ok(js.includes('llmLastRouteTraceMeta'));
});
