'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: alerts use deterministic destination mapping for operator flows', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('const OPERATOR_DESTINATION_MAP = Object.freeze({'));
  assert.ok(js.includes('function resolveOperatorAlertDestination(item) {'));
  assert.ok(js.includes('function openOperatorDestinationPane(paneKey, options) {'));
  assert.ok(js.includes("openOperatorDestinationPane(target, { historyMode: 'push' });"));
  assert.ok(js.includes("openOperatorDestinationPane(targetPane, { historyMode: 'push' });"));
  assert.ok(js.includes('composer: Object.freeze({ pane: \'composer\''));
  assert.ok(js.includes('monitor: Object.freeze({ pane: \'monitor\''));
  assert.ok(js.includes("'read-model': Object.freeze({ pane: 'read-model'"));
  assert.ok(js.includes("'city-pack:guide': Object.freeze({"));
  assert.ok(js.includes("'city-pack:emergency': Object.freeze({"));
  assert.ok(js.includes('maintenance: Object.freeze({ pane: \'maintenance\''));
});
