'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const opsConfigRepo = require('../../src/repos/firestore/opsConfigRepo');
const { getDisclaimer } = require('../../src/llm/disclaimers');

test('phase658: llm policy normalize supports forbidden/disclaimer/output constraints add-only fields', () => {
  const normalized = opsConfigRepo.normalizeLlmPolicy({
    enabled: true,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    top_p: 1,
    max_output_tokens: 700,
    per_user_daily_limit: 30,
    per_user_token_budget: 15000,
    global_qps_limit: 7,
    cache_ttl_sec: 90,
    allowed_intents_free: ['faq_search'],
    allowed_intents_pro: ['next_action_generation', 'risk_alert', 'faq_search'],
    safety_mode: 'strict',
    forbidden_domains: ['risk_alert', ' Legal_Advice '],
    disclaimer_templates: {
      generic: 'GENERIC',
      faq: 'FAQ',
      ops_explain: 'OPS',
      next_actions: 'NEXT',
      paid_assistant: 'PAID'
    },
    output_constraints: {
      max_next_actions: 2,
      max_gaps: 4,
      max_risks: 2,
      require_evidence: true,
      forbid_direct_url: true
    }
  });

  assert.ok(normalized);
  assert.deepEqual(normalized.forbidden_domains, ['risk_alert', 'legal_advice']);
  assert.equal(normalized.disclaimer_templates.paid_assistant, 'PAID');
  assert.equal(normalized.output_constraints.max_next_actions, 2);
  assert.equal(normalized.output_constraints.max_gaps, 4);
  assert.equal(normalized.output_constraints.max_risks, 2);
  assert.equal(normalized.output_constraints.require_evidence, true);
  assert.equal(normalized.output_constraints.forbid_direct_url, true);
});

test('phase658: disclaimer helper prioritizes llm policy templates', () => {
  const disclaimer = getDisclaimer('faq', {
    policy: {
      disclaimer_templates: {
        faq: 'POLICY_FAQ',
        generic: 'POLICY_GENERIC'
      }
    }
  });
  assert.equal(disclaimer.text, 'POLICY_FAQ');
  assert.ok(String(disclaimer.version || '').includes('policy_'));
});
