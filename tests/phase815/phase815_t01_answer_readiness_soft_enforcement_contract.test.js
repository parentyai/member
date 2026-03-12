'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveAnswerReadinessV2Mode } = require('../../src/domain/llm/quality/resolveAnswerReadinessV2Mode');

test('phase815: answer readiness v2 defaults to log-only when enforcement flags are disabled', () => {
  const mode = resolveAnswerReadinessV2Mode({
    entryType: 'admin',
    readinessLegacy: { decision: 'allow', reasonCodes: [] },
    readinessV2: { decision: 'refuse', reasonCodes: ['legal_blocked'] }
  }, {
    ENABLE_ANSWER_READINESS_V2_LOG_ONLY: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE: 'false',
    ENABLE_ANSWER_READINESS_V2_ENFORCE_WEBHOOK: 'false'
  });

  assert.equal(mode.stage, 'log_only');
  assert.equal(mode.mode, 'log_only_v2');
  assert.equal(mode.enforceV2, false);
  assert.equal(mode.answerReadinessLogOnlyV2, true);
  assert.equal(mode.answerReadinessEnforcedV2, false);
});

test('phase815: soft enforcement applies only to soft routes with critical reason codes', () => {
  const mode = resolveAnswerReadinessV2Mode({
    entryType: 'faq',
    readinessLegacy: { decision: 'allow', reasonCodes: [] },
    readinessV2: { decision: 'refuse', reasonCodes: ['saved_faq_high_risk_not_ready'] }
  }, {
    ENABLE_ANSWER_READINESS_V2_LOG_ONLY: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE_WEBHOOK: 'false'
  });

  assert.equal(mode.stage, 'soft_enforcement');
  assert.equal(mode.mode, 'soft_enforced_v2');
  assert.equal(mode.enforceV2, true);
  assert.equal(mode.answerReadinessLogOnlyV2, false);
  assert.equal(mode.answerReadinessEnforcedV2, true);
  assert.equal(mode.enforcementReason, 'soft_critical_reason_match');
});

test('phase815: webhook remains log-only until hard enforcement flag is enabled', () => {
  const mode = resolveAnswerReadinessV2Mode({
    entryType: 'webhook',
    readinessLegacy: { decision: 'allow', reasonCodes: [] },
    readinessV2: { decision: 'clarify', reasonCodes: ['journey_task_conflict'] }
  }, {
    ENABLE_ANSWER_READINESS_V2_LOG_ONLY: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE_WEBHOOK: 'false'
  });

  assert.equal(mode.stage, 'soft_enforcement');
  assert.equal(mode.mode, 'log_only_v2');
  assert.equal(mode.enforceV2, false);
  assert.equal(mode.answerReadinessLogOnlyV2, true);
});

test('phase815: hard enforcement applies to webhook routes when dedicated flag is enabled', () => {
  const mode = resolveAnswerReadinessV2Mode({
    entryType: 'webhook',
    readinessLegacy: { decision: 'allow', reasonCodes: [] },
    readinessV2: { decision: 'refuse', reasonCodes: ['official_only_not_satisfied'] }
  }, {
    ENABLE_ANSWER_READINESS_V2_LOG_ONLY: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE: 'true',
    ENABLE_ANSWER_READINESS_V2_ENFORCE_WEBHOOK: 'true'
  });

  assert.equal(mode.stage, 'hard_enforcement');
  assert.equal(mode.mode, 'hard_enforced_v2');
  assert.equal(mode.enforceV2, true);
  assert.equal(mode.answerReadinessEnforcedV2, true);
  assert.equal(mode.answerReadinessLogOnlyV2, false);
});
