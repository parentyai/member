'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { reviewSourceRefDecision } = require('../../src/usecases/cityPack/reviewSourceRefDecision');

test('phase250: confirm extends validUntil by 120 days and sets active', async () => {
  const now = new Date('2026-02-18T00:00:00.000Z');
  const state = {
    id: 'sr_confirm',
    status: 'needs_review',
    validUntil: new Date('2026-02-20T00:00:00.000Z')
  };
  const audits = [];

  const result = await reviewSourceRefDecision(
    {
      sourceRefId: 'sr_confirm',
      decision: 'confirm',
      actor: 'phase250_test',
      traceId: 'trace_phase250_confirm',
      now
    },
    {
      getSourceRef: async () => Object.assign({}, state),
      updateSourceRef: async (_id, patch) => {
        Object.assign(state, patch);
        return { id: state.id };
      },
      appendAuditLog: async (payload) => {
        audits.push(payload);
        return { id: 'audit_confirm' };
      }
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'active');
  assert.ok(state.validUntil instanceof Date);
  const expected = new Date('2026-06-18T00:00:00.000Z').toISOString();
  assert.strictEqual(state.validUntil.toISOString(), expected);
  assert.strictEqual(audits.length, 1);
  assert.strictEqual(audits[0].action, 'source_ref.review.confirm');
});
