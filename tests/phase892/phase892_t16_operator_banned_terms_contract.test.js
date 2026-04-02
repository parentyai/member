'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start === -1) return '';
  const end = endToken ? source.indexOf(endToken, start) : -1;
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

test('phase892: operator first-view surfaces avoid internal evidence jargon', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const operatorSlices = [
    sliceBetween(html, 'data-v3-nav-group="operator-primary"', 'data-v3-nav-group="system-console"'),
    sliceBetween(html, 'id="pane-home"', 'id="home-kpi-details"'),
    sliceBetween(html, 'id="pane-alerts"', 'id="pane-composer"'),
    sliceBetween(html, 'id="read-model-task-summary"', 'id="users-summary-columns-panel"'),
    sliceBetween(html, 'id="city-pack-operator-surface"', 'id="city-pack-reflection-state"'),
    sliceBetween(html, 'id="faq-operator-surface"', 'class="pane-grid llm-workspace-grid"'),
  ].join('\n').replace(/<[^>]+>/g, ' ');

  ['trace', 'evidence', 'policy', 'diagnostics', 'JSON', 'Selection Detail', 'Blocked'].forEach((term) => {
    assert.ok(!operatorSlices.includes(term), `operator first view should not include ${term}`);
  });
});
