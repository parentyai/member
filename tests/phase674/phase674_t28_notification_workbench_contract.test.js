'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: composer workbench exposes state machine, scenario/step overview, schema fields, and fix guidance', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  const composerPane = extractPaneSection(html, 'composer');
  assert.ok(composerPane, 'pane-composer must exist');

  assert.ok(composerPane.includes('id="composer-state-bar"'));
  ['draft', 'approve', 'plan', 'execute', 'sent'].forEach((step) => {
    assert.ok(
      composerPane.includes(`data-composer-state-step="${step}"`),
      `state bar step is missing: ${step}`
    );
  });

  assert.ok(composerPane.includes('id="composer-flow-current"'));
  assert.ok(composerPane.includes('id="composer-flow-scenarios"'));
  assert.ok(composerPane.includes('id="composer-flow-steps"'));
  assert.ok(composerPane.includes('id="composer-schema-selected"'));
  assert.ok(composerPane.includes('id="composer-schema-required"'));
  assert.ok(composerPane.includes('id="composer-schema-optional"'));
  assert.ok(composerPane.includes('id="composer-fix-guidance"'));

  assert.ok(composerPane.includes('id="composer-open-audit"'));
  assert.ok(composerPane.includes('id="composer-open-trace-monitor"'));

  assert.ok(js.includes('function renderComposerStateBar(gateState) {'));
  assert.ok(js.includes('function renderComposerFlowOverview(payload) {'));
  assert.ok(js.includes('function renderComposerTypeSchemaOverview() {'));
  assert.ok(js.includes('function renderComposerFixGuidance(gateState, issues) {'));
  assert.ok(js.includes("document.getElementById('composer-open-audit')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('composer-open-trace-monitor')?.addEventListener('click'"));
  assert.ok(js.includes('renderComposerStateBar(gateState);'));
  assert.ok(js.includes('renderComposerFlowOverview(payload);'));
});
