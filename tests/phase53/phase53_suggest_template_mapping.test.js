'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestNotificationTemplate } = require('../../src/usecases/phase53/suggestNotificationTemplate');

test('phase53: suggest template mapping', async () => {
  const esc = await suggestNotificationTemplate({ nextAction: 'STOP_AND_ESCALATE' });
  const fix = await suggestNotificationTemplate({ nextAction: 'FIX_AND_RERUN' });
  const rerun = await suggestNotificationTemplate({ nextAction: 'RERUN_MAIN' });
  const none = await suggestNotificationTemplate({ nextAction: 'NO_ACTION' });

  assert.strictEqual(esc.templateKey, 'ops_escalate');
  assert.strictEqual(fix.templateKey, 'ops_fix_and_rerun');
  assert.strictEqual(rerun.templateKey, 'ops_rerun_main');
  assert.strictEqual(none.templateKey, null);
});
