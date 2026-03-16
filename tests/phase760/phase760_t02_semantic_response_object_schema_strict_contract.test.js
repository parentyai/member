'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseSemanticResponseObjectStrict,
  validateSemanticResponseObject
} = require('../../src/v1/semantic/semanticResponseObject');

test('phase760: semantic response strict parser accepts valid payload', () => {
  const parsed = parseSemanticResponseObjectStrict(JSON.stringify({
    version: 'v1',
    contract_version: 'sro_v2',
    intent: 'general',
    stage: 'arrival',
    answer_mode: 'answer',
    action_class: 'assist',
    confidence_band: 'MEDIUM',
    tasks: [{ title: '役所の予約を確認する' }],
    warnings: [],
    evidence_refs: [],
    follow_up_questions: ['どの州ですか？'],
    memory_read_scopes: ['session_memory'],
    memory_write_scopes: ['compliance_memory'],
    handoff_state: 'NONE',
    service_surface: 'text',
    response_chunks: ['要点です。'],
    response_markdown: '要点です。',
    path_type: 'slow',
    u_units: ['U-16', 'U-17'],
    group_privacy_mode: 'direct',
    quick_replies: [],
    policy_trace: {
      policy_source: 'system_flags',
      legal_decision: 'allow',
      safety_gate: 'default',
      disclosure_required: false,
      escalation_required: false,
      reason_codes: []
    },
    citation_summary: {
      finalized: true,
      readiness_decision: 'allow',
      freshness_status: 'fresh',
      authority_satisfied: true,
      disclaimer_required: false
    },
    response_contract: {
      style: 'coach',
      intent: 'general',
      summary: '要点です。',
      next_steps: ['一つ目'],
      pitfall: null,
      followup_question: null,
      evidence_footer: null,
      safety_notes: []
    }
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.response_contract.summary, '要点です。');
  assert.equal(parsed.value.contract_version, 'sro_v2');
  assert.equal(parsed.value.intent, 'general');
  assert.equal(parsed.value.path_type, 'slow');
});

test('phase760: semantic response strict parser keeps legacy response_contract input non-breaking', () => {
  const parsed = parseSemanticResponseObjectStrict(JSON.stringify({
    version: 'v1',
    response_contract: {
      style: 'coach',
      intent: 'ssn',
      summary: 'SSNの流れです。',
      next_steps: ['申請書類を確認'],
      pitfall: null,
      followup_question: '州はどこですか？',
      evidence_footer: null,
      safety_notes: []
    }
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.contract_version, 'sro_v2');
  assert.equal(parsed.value.intent, 'ssn');
  assert.equal(parsed.value.response_contract.summary, 'SSNの流れです。');
  assert.ok(parsed.value.response_markdown.includes('SSNの流れです。'));
});

test('phase760: semantic response strict parser falls back on invalid payload', () => {
  const parsed = parseSemanticResponseObjectStrict('{invalid-json');
  assert.equal(parsed.ok, false);
  const validated = validateSemanticResponseObject(parsed.value);
  assert.equal(validated.ok, true);
  assert.equal(parsed.value.version, 'v1');
});
