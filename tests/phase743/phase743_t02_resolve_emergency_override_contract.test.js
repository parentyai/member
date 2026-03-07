'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveEmergencyOverride } = require('../../src/usecases/uxos/resolveEmergencyOverride');

test('phase743: resolveEmergencyOverride returns active when sent bulletin matches user region and age window', async () => {
  const prevFlag = process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  const prevAge = process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS;
  process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = '1';
  process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS = '24';
  try {
    const result = await resolveEmergencyOverride({
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
            id: 'emb_743',
            status: 'sent',
            regionKey: 'tx::statewide',
            severity: 'CRITICAL',
            category: 'weather',
            headline: 'Storm Alert',
            sentAt: '2026-03-07T04:00:00.000Z'
          }];
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.active, true);
    assert.equal(result.reason, 'emergency_override_active');
    assert.equal(result.recommendation.action, 'CHECK_EMERGENCY_ALERT');
    assert.equal(result.recommendation.emergency.bulletinId, 'emb_743');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
    else process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = prevFlag;
    if (prevAge === undefined) delete process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS;
    else process.env.UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS = prevAge;
  }
});

test('phase743: resolveEmergencyOverride fail-opens when user region is missing', async () => {
  const prevFlag = process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = '1';
  try {
    const result = await resolveEmergencyOverride({
      lineUserId: 'U743'
    }, {
      usersRepo: {
        async getUser() {
          return { id: 'U743' };
        }
      },
      emergencyBulletinsRepo: {
        async listBulletins() {
          return [];
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, true);
    assert.equal(result.active, false);
    assert.equal(result.reason, 'region_key_missing');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
    else process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = prevFlag;
  }
});
