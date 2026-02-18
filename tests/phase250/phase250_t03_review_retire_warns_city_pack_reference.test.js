'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { reviewSourceRefDecision } = require('../../src/usecases/cityPack/reviewSourceRefDecision');

test('phase250: retire returns warning when source is still used by city packs', async () => {
  const sourceRef = {
    id: 'sr_retire',
    status: 'needs_review',
    usedByCityPackIds: ['cp_tokyo']
  };

  const result = await reviewSourceRefDecision(
    {
      sourceRefId: 'sr_retire',
      decision: 'retire',
      actor: 'phase250_test',
      traceId: 'trace_phase250_retire'
    },
    {
      getSourceRef: async () => Object.assign({}, sourceRef),
      updateSourceRef: async (_id, patch) => {
        Object.assign(sourceRef, patch);
        return { id: sourceRef.id };
      },
      appendAuditLog: async () => ({ id: 'audit_retire' })
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'retired');
  assert.strictEqual(result.warning, 'city_pack_reference_exists');
  assert.strictEqual(sourceRef.status, 'retired');
});
