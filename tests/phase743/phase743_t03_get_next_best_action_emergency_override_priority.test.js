'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getNextBestAction } = require('../../src/usecases/uxos/getNextBestAction');

test('phase743: getNextBestAction prioritizes emergency override before task/llm paths', async () => {
  const prevNba = process.env.ENABLE_UXOS_NBA;
  const prevOverride = process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  process.env.ENABLE_UXOS_NBA = '1';
  process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = '1';
  try {
    const result = await getNextBestAction({
      lineUserId: 'U743',
      now: '2026-03-07T12:00:00.000Z'
    }, {
      usersRepo: {
        async getUser() {
          return { id: 'U743', regionKey: 'tx::statewide' };
        }
      },
      emergencyBulletinsRepo: {
        async listBulletins() {
          return [{
            id: 'emb_priority',
            status: 'sent',
            regionKey: 'tx::statewide',
            severity: 'WARN',
            category: 'weather',
            sentAt: '2026-03-07T11:30:00.000Z'
          }];
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.source, 'emergency_override');
    assert.equal(result.recommendation.action, 'CHECK_EMERGENCY_ALERT');
    assert.equal(result.recommendation.reason, 'emergency_override_active');
  } finally {
    if (prevNba === undefined) delete process.env.ENABLE_UXOS_NBA;
    else process.env.ENABLE_UXOS_NBA = prevNba;
    if (prevOverride === undefined) delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
    else process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = prevOverride;
  }
});
