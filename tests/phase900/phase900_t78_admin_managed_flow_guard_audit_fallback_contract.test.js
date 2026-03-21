'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadGuardWithAppend(appendAuditLogImpl) {
  const appendPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const guardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const originalAppend = require.cache[appendPath];
  const originalGuard = require.cache[guardPath];

  require.cache[appendPath] = {
    id: appendPath,
    filename: appendPath,
    loaded: true,
    exports: {
      appendAuditLog: appendAuditLogImpl
    }
  };
  delete require.cache[guardPath];

  const guardModule = require('../../src/routes/admin/managedFlowGuard');
  return {
    guardModule,
    restore() {
      if (originalAppend) require.cache[appendPath] = originalAppend;
      else delete require.cache[appendPath];
      if (originalGuard) require.cache[guardPath] = originalGuard;
      else delete require.cache[guardPath];
    }
  };
}

test('phase900: managed flow guard audit helpers use module appendAuditLog fallback when deps are omitted', async () => {
  const captured = [];
  const { guardModule, restore } = loadGuardWithAppend(async (entry) => {
    captured.push(entry);
    return { id: `audit_${captured.length}` };
  });
  try {
    await guardModule.auditManagedFlowViolation({ actionKey: 'phase900.violation.fallback' });
    await guardModule.auditManagedFlowWarning({ actionKey: 'phase900.warning.fallback' });

    assert.equal(captured.length, 2);
    assert.equal(captured[0].action, 'managed_flow.guard.violation');
    assert.equal(captured[1].action, 'managed_flow.guard.warning');
    assert.equal(captured[0].entityId, 'phase900.violation.fallback');
    assert.equal(captured[1].entityId, 'phase900.warning.fallback');
  } finally {
    restore();
  }
});

test('phase900: managed flow guard audit helpers swallow appendAuditLog failures (best effort)', async () => {
  const { guardModule, restore } = loadGuardWithAppend(async () => {
    throw new Error('AUDIT_STORE_DOWN_PHASE900');
  });
  try {
    await assert.doesNotReject(async () => {
      await guardModule.auditManagedFlowViolation({ actionKey: 'phase900.violation.best_effort' });
    });
    await assert.doesNotReject(async () => {
      await guardModule.auditManagedFlowWarning({ actionKey: 'phase900.warning.best_effort' });
    });
  } finally {
    restore();
  }
});
