'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

test('phase233: next action candidates are abstract-only and sanitized to contract keys', async () => {
  const result = await getNextActionCandidates(
    {
      lineUserId: 'U_PHASE233',
      traceId: 'TRACE_PHASE233_NEXT',
      consoleResult: {
        readiness: { status: 'READY', blocking: [] },
        opsState: { nextAction: 'REVIEW' },
        latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2026-02-17T00:00:00.000Z' },
        allowedNextActions: ['MONITOR', 'REVIEW', 'DEFER']
      }
    },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      appendAuditLog: async () => ({ id: 'audit-233-next' }),
      llmAdapter: {
        suggestNextActionCandidates: async () => ({
          nextActionCandidates: {
            schemaId: 'NextActionCandidates.v1',
            generatedAt: '2026-02-17T00:00:00.000Z',
            advisoryOnly: true,
            candidates: [
              {
                action: 'MONITOR',
                reason: 'monitor now',
                confidence: 0.8,
                safety: { status: 'OK', reasons: [] },
                rawCommand: 'should_be_removed'
              },
              {
                action: 'REVIEW',
                reason: 'review checklist',
                confidence: 0.7,
                safety: { status: 'OK', reasons: ['attention'] },
                debug: { keep: false }
              },
              {
                action: 'DEFER',
                reason: 'defer until evidence',
                confidence: 0.4,
                safety: { status: 'BLOCK', reasons: ['missing evidence'] },
                internalField: 123
              }
            ]
          }
        })
      }
    }
  );

  assert.strictEqual(result.ok, true);
  assert.ok(result.nextActionCandidates);
  assert.ok(Array.isArray(result.nextActionCandidates.candidates));
  assert.ok(result.nextActionCandidates.candidates.length <= 3);
  const allowed = new Set(['MONITOR', 'REVIEW', 'ESCALATE', 'DEFER', 'NO_ACTION']);
  for (const item of result.nextActionCandidates.candidates) {
    assert.ok(allowed.has(item.action));
    assert.deepStrictEqual(Object.keys(item).sort(), ['action', 'confidence', 'reason', 'safety']);
  }

  assert.ok(result.nextActionTemplate);
  assert.strictEqual(result.nextActionTemplate.templateVersion, 'next_actions_template_v1');
  assert.ok(result.nextActionTemplate.currentState);
  assert.ok(Array.isArray(result.nextActionTemplate.missingItems));
  assert.ok(result.nextActionTemplate.timelineSummary);
  assert.ok(result.nextActionTemplate.proposal);
});
