'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { alertsCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: actionable alerts keep operable non-zero rows only', () => {
  const extracted = alertsCore.extractActionable([
    { type: 'target_zero', count: 4, actionPane: 'composer' },
    { type: 'kill_switch_on', count: 1, actionPane: 'settings' },
    { type: 'unapproved_notifications', count: 0, actionPane: 'composer' },
    { type: 'retry_queue_pending', count: 3 },
    { type: 'link_warn', count: 2, actionPane: 'vendors' }
  ], { operableOnly: true, allowZero: false });

  assert.deepEqual(
    extracted.map((item) => item.type),
    ['link_warn', 'kill_switch_on', 'target_zero']
  );
  assert.ok(extracted.every((item) => item.count > 0));
  assert.ok(extracted.every((item) => item.actionPane));
});

test('phase635: actionable summary aggregates counts', () => {
  const summary = alertsCore.summarizeActionable([
    { severity: 'DANGER', count: 5 },
    { severity: 'WARN', count: 2 },
    { severity: 'INFO', count: 1 }
  ]);
  assert.equal(summary.total, 8);
  assert.equal(summary.danger, 1);
  assert.equal(summary.warn, 1);
});
