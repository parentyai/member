'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getRequiredAuditActionsForScenario } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase631: required audit action map covers all fixed e2e scenarios', () => {
  const expected = {
    product_readiness_gate: ['product_readiness.view'],
    segment: ['segment_send.plan', 'segment_send.dry_run', 'segment_send.execute'],
    retry_queue: ['retry_queue.plan', 'retry_queue.execute'],
    kill_switch_block: ['kill_switch.plan', 'kill_switch.set', 'retry_queue.execute'],
    composer_cap_block: ['notifications.send.plan', 'notifications.send.execute']
  };

  Object.entries(expected).forEach(([scenario, actions]) => {
    assert.deepStrictEqual(getRequiredAuditActionsForScenario(scenario), actions, `scenario=${scenario}`);
  });

  assert.deepStrictEqual(getRequiredAuditActionsForScenario('unknown'), []);
});
