'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { auditManagedFlowWarning } = require('../../src/routes/admin/managedFlowGuard');

test('phase900: managed flow guard warning audit helper keeps explicit entry fields over defaults', async () => {
  const entries = [];
  await auditManagedFlowWarning({
    actor: 'phase900_actor',
    action: 'custom.warning.action',
    entityType: 'custom_entity',
    entityId: 'custom_id',
    actionKey: 'phase900.warning.sample',
    traceId: 'trace_phase900_audit_warning'
  }, {
    appendAuditLog: async (entry) => {
      entries.push(entry);
    }
  });

  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.actor, 'phase900_actor');
  assert.equal(entry.action, 'custom.warning.action');
  assert.equal(entry.entityType, 'custom_entity');
  assert.equal(entry.entityId, 'custom_id');
  assert.equal(entry.actionKey, 'phase900.warning.sample');
  assert.equal(entry.traceId, 'trace_phase900_audit_warning');
});
