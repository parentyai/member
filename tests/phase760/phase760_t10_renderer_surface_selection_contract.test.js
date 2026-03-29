'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  resolveLineSurfacePlan,
  selectLineSurface
} = require('../../src/v1/line_surface_policy/lineInteractionPolicy');
const { buildSemanticLineMessage } = require('../../src/v1/line_renderer/semanticLineMessage');

test('phase760: line surface policy selects handoff and flex appropriately', () => {
  assert.equal(selectLineSurface({ handoffRequired: true, miniAppUrl: 'https://example.com' }), 'mini_app');
  assert.equal(selectLineSurface({ handoffRequired: true, liffUrl: 'https://liff.line.me/xxx' }), 'liff');
  assert.equal(selectLineSurface({ text: 'a'.repeat(900) }), 'flex');
  assert.equal(selectLineSurface({ text: 'ok' }), 'text');
});

test('phase760: line surface policy selects quick reply and template only when actions exist', () => {
  assert.equal(selectLineSurface({
    text: '必要書類を確認します。',
    quickReplies: [{ label: '必要書類', text: '必要書類を教えて' }]
  }), 'quick_reply');
  assert.equal(selectLineSurface({
    requestedSurface: 'template',
    text: '必要書類を確認します。',
    quickReplies: [{ label: '必要書類', text: '必要書類を教えて' }]
  }), 'template');
  const degraded = resolveLineSurfacePlan({
    requestedSurface: 'template',
    text: '必要書類を確認します。'
  });
  assert.equal(degraded.surface, 'text');
  assert.equal(degraded.degraded, true);
  assert.equal(degraded.degradedFrom, 'template');
  assert.equal(selectLineSurface({
    requestedSurface: 'template',
    text: '公式確認はこちらです。',
    templateActions: [{ type: 'uri', label: 'SSA', uri: 'https://www.ssa.gov/number-card' }]
  }), 'template');
});

test('phase760: semantic line renderer builds quick reply and template messages from canonical SRO', () => {
  const quickReply = buildSemanticLineMessage({
    semanticResponseObject: {
      version: 'v1',
      contract_version: 'sro_v2',
      intent: 'ssn',
      stage: 'arrival',
      answer_mode: 'answer',
      action_class: 'assist',
      confidence_band: 'MEDIUM',
      tasks: [],
      warnings: [],
      evidence_refs: [],
      follow_up_questions: [],
      memory_read_scopes: [],
      memory_write_scopes: [],
      handoff_state: 'NONE',
      service_surface: 'quick_reply',
      response_chunks: ['必要書類を確認します。'],
      response_markdown: '必要書類を確認します。',
      path_type: 'slow',
      u_units: ['U-17'],
      group_privacy_mode: 'direct',
      quick_replies: [{ label: '必要書類', text: '必要書類を教えて' }],
      policy_trace: {},
      citation_summary: {},
      response_contract: {
        style: 'coach',
        intent: 'ssn',
        summary: '必要書類を確認します。',
        next_steps: [],
        pitfall: null,
        followup_question: null,
        evidence_footer: null,
        safety_notes: []
      }
    }
  });
  assert.equal(quickReply.message.type, 'text');
  assert.ok(quickReply.message.quickReply);

  const template = buildSemanticLineMessage({
    semanticResponseObject: {
      version: 'v1',
      contract_version: 'sro_v2',
      intent: 'ssn',
      stage: 'arrival',
      answer_mode: 'answer',
      action_class: 'assist',
      confidence_band: 'MEDIUM',
      tasks: [],
      warnings: [],
      evidence_refs: [],
      follow_up_questions: [],
      memory_read_scopes: [],
      memory_write_scopes: [],
      handoff_state: 'NONE',
      service_surface: 'template',
      response_chunks: ['必要書類を確認します。'],
      response_markdown: '必要書類を確認します。',
      path_type: 'slow',
      u_units: ['U-17'],
      group_privacy_mode: 'direct',
      quick_replies: [{ label: '必要書類', text: '必要書類を教えて' }],
      policy_trace: {},
      citation_summary: {},
      response_contract: {
        style: 'coach',
        intent: 'ssn',
        summary: '必要書類を確認します。',
        next_steps: [],
        pitfall: null,
        followup_question: null,
        evidence_footer: null,
        safety_notes: []
      }
    }
  });
  assert.equal(template.message.type, 'template');
  assert.equal(template.surfacePlan.surface, 'template');

  const templateWithUri = buildSemanticLineMessage({
    templateActions: [{ type: 'uri', label: 'SSA', uri: 'https://www.ssa.gov/number-card' }],
    semanticResponseObject: {
      version: 'v1',
      contract_version: 'sro_v2',
      intent: 'ssn',
      stage: 'arrival',
      answer_mode: 'answer',
      action_class: 'assist',
      confidence_band: 'MEDIUM',
      tasks: [],
      warnings: [],
      evidence_refs: [],
      follow_up_questions: [],
      memory_read_scopes: [],
      memory_write_scopes: [],
      handoff_state: 'NONE',
      service_surface: 'template',
      response_chunks: ['公式確認はこちらです。'],
      response_markdown: '公式確認はこちらです。',
      path_type: 'slow',
      u_units: ['U-17'],
      group_privacy_mode: 'direct',
      quick_replies: [],
      policy_trace: {},
      citation_summary: {},
      response_contract: {
        style: 'coach',
        intent: 'ssn',
        summary: '公式確認はこちらです。',
        next_steps: [],
        pitfall: null,
        followup_question: null,
        evidence_footer: null,
        safety_notes: []
      }
    }
  });
  assert.equal(templateWithUri.message.type, 'template');
  assert.equal(templateWithUri.message.template.actions[0].type, 'uri');
  assert.equal(templateWithUri.message.template.actions[0].uri, 'https://www.ssa.gov/number-card');
});
