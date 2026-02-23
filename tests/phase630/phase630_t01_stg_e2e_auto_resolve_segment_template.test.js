'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  resolveSegmentTemplateKey
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase630: resolveSegmentTemplateKey uses explicit input when provided', async () => {
  let called = false;
  const result = await resolveSegmentTemplateKey(
    {},
    'trace-1',
    'manual_template_key',
    async () => {
      called = true;
      return { okStatus: false };
    }
  );
  assert.strictEqual(result.templateKey, 'manual_template_key');
  assert.strictEqual(result.source, 'input');
  assert.strictEqual(result.reason, null);
  assert.strictEqual(called, false);
});

test('phase630: resolveSegmentTemplateKey auto-picks active e2e template when input missing', async () => {
  const result = await resolveSegmentTemplateKey(
    {},
    'trace-2',
    '',
    async (_ctx, method, endpoint) => {
      assert.strictEqual(method, 'GET');
      assert.strictEqual(endpoint, '/api/phase61/templates?status=active');
      return {
        okStatus: true,
        body: {
          ok: true,
          items: [
            { key: 'ops_daily_template' },
            { key: 'e2e_seg_fix_1770825681' }
          ]
        }
      };
    }
  );

  assert.strictEqual(result.templateKey, 'e2e_seg_fix_1770825681');
  assert.strictEqual(result.source, 'auto');
  assert.strictEqual(result.reason, null);
});
