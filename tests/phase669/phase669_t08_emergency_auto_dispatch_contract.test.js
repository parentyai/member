'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { autoDispatchEmergencyBulletin } = require('../../src/usecases/emergency/autoDispatchEmergencyBulletin');

test('phase669: auto dispatch dry-run audits preview and does not call approve', async () => {
  const audits = [];
  const approveCalls = [];

  const result = await autoDispatchEmergencyBulletin({
    bulletinId: 'emb_phase669_auto_dryrun',
    dryRun: true,
    traceId: 'trace_phase669_auto_dryrun',
    runId: 'run_phase669_auto_dryrun',
    rule: {
      ruleId: 'emr_phase669_dryrun',
      membersOnly: true,
      maxRecipients: 200,
      region: { regionKey: 'TX::statewide' }
    }
  }, {
    getBulletin: async () => ({
      id: 'emb_phase669_auto_dryrun',
      status: 'draft',
      regionKey: 'TX::statewide'
    }),
    resolveEmergencyRecipientsForFanout: async () => ({
      ok: true,
      regionKey: 'TX::statewide',
      totalRecipientCount: 42,
      buckets: [],
      unsupportedDimensions: []
    }),
    approveEmergencyBulletin: async () => {
      approveCalls.push(true);
      return { ok: true };
    },
    appendAuditLog: async (entry) => {
      audits.push(entry);
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.recipientCountApplied, 42);
  assert.equal(approveCalls.length, 0);
  assert.ok(audits.some((item) => item && item.action === 'emergency.auto_dispatch.preview'));
});

test('phase669: auto dispatch fails closed for unsupported target dimensions', async () => {
  const audits = [];
  const approveCalls = [];

  const result = await autoDispatchEmergencyBulletin({
    bulletinId: 'emb_phase669_auto_blocked',
    traceId: 'trace_phase669_auto_blocked',
    runId: 'run_phase669_auto_blocked',
    rule: {
      ruleId: 'emr_phase669_blocked',
      role: 'vip',
      maxRecipients: 200,
      region: { regionKey: 'TX::statewide' }
    }
  }, {
    getBulletin: async () => ({
      id: 'emb_phase669_auto_blocked',
      status: 'draft',
      regionKey: 'TX::statewide'
    }),
    resolveEmergencyRecipientsForFanout: async () => ({
      ok: false,
      reason: 'unsupported_target_dimension',
      regionKey: 'TX::statewide',
      unsupportedDimensions: ['role'],
      totalRecipientCount: 0,
      buckets: []
    }),
    approveEmergencyBulletin: async () => {
      approveCalls.push(true);
      return { ok: true };
    },
    appendAuditLog: async (entry) => {
      audits.push(entry);
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'unsupported_target_dimension');
  assert.equal(approveCalls.length, 0);
  assert.ok(audits.some((item) => item && item.action === 'emergency.auto_dispatch.blocked'));
});
