'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase261: decision state rules are fixed to READY/ATTENTION/STOP', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes("function decisionStateLabel(stateValue)"));
  assert.ok(js.includes("return t('ui.label.decision.state.stop', 'STOP');"));
  assert.ok(js.includes("return t('ui.label.decision.state.attention', 'ATTENTION');"));
  assert.ok(js.includes("return t('ui.label.decision.state.ready', 'READY');"));

  assert.ok(js.includes("const decisionState = counts.DANGER > 0 ? 'STOP' : counts.WARN > 0 ? 'ATTENTION' : 'READY';"));
  assert.ok(js.includes("const decisionState = warnLinks > 0 ? 'STOP' : retryQueue > 0 ? 'ATTENTION' : 'READY';"));
  assert.ok(js.includes("const decisionState = blocked > 0 ? 'STOP' : needsReview > 0 ? 'ATTENTION' : 'READY';"));
  assert.ok(js.includes("const decisionState = warnCount >= 3 ? 'STOP' : (warnCount > 0 || staleCount > 0) ? 'ATTENTION' : 'READY';"));
});

test('phase261: details auto-open for ATTENTION/STOP', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("vm.state === 'ATTENTION' || vm.state === 'STOP'"));
  assert.ok(js.includes('detailsEl.open = true;'));
});
