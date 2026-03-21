'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { auditManagedFlowViolation } = require('../../src/routes/admin/managedFlowGuard');

test('phase900: managed flow guard violation audit helper applies default envelope fields', async () => {
  const entries = [];
  await auditManagedFlowViolation({
    actionKey: 'phase900.violation.sample',
    traceId: 'trace_phase900_audit_violation'
  }, {
    appendAuditLog: async (entry) => {
      entries.push(entry);
    }
  });

  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.actor, 'unknown');
  assert.equal(entry.action, 'managed_flow.guard.violation');
  assert.equal(entry.entityType, 'managed_flow');
  assert.equal(entry.entityId, 'phase900.violation.sample');
  assert.equal(entry.traceId, 'trace_phase900_audit_violation');
});
