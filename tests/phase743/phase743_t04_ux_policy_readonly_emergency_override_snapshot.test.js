'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleStatus } = require('../../src/routes/admin/uxPolicyReadonly');

function createResCapture() {
  return {
    statusCode: 0,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

test('phase743: ux-policy readonly snapshot includes emergency override mode and flag', async () => {
  const prevReadonly = process.env.ENABLE_UXOS_POLICY_READONLY;
  const prevOverride = process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
  process.env.ENABLE_UXOS_POLICY_READONLY = '1';
  process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = '1';
  try {
    const req = {
      url: '/api/admin/os/ux-policy/readonly',
      headers: {
        'x-actor': 'phase743_tester',
        'x-trace-id': 'trace743_policy',
        'x-request-id': 'req743_policy'
      }
    };
    const res = createResCapture();
    await handleStatus(req, res, {
      journeyPolicyRepo: { async getJourneyPolicy() { return { enabled: true }; } },
      journeyGraphCatalogRepo: { async getJourneyGraphCatalog() { return { enabled: true, ruleSet: { reactionBranches: [{ id: 'r1' }] } }; } },
      journeyParamRuntimeRepo: { async getJourneyParamRuntime() { return { activeVersionId: 'v1' }; } },
      richMenuPolicyRepo: { async getRichMenuPolicy() { return { enabled: true, updateEnabled: true }; } },
      opsConfigRepo: { async getLlmPolicy() { return { enabled: true, lawfulBasis: 'contract', consentVerified: true }; } },
      systemFlagsRepo: { async getLlmEnabled() { return true; } }
    });
    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body || '{}');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.enabled, true);
    assert.equal(parsed.snapshot.flags.uxosEmergencyOverrideEnabled, true);
    assert.equal(parsed.snapshot.notification.emergencyOverrideMode, 'region_sent_bulletin');
  } finally {
    if (prevReadonly === undefined) delete process.env.ENABLE_UXOS_POLICY_READONLY;
    else process.env.ENABLE_UXOS_POLICY_READONLY = prevReadonly;
    if (prevOverride === undefined) delete process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE;
    else process.env.ENABLE_UXOS_EMERGENCY_OVERRIDE = prevOverride;
  }
});
