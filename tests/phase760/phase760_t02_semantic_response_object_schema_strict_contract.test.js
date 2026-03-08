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
});

test('phase760: semantic response strict parser falls back on invalid payload', () => {
  const parsed = parseSemanticResponseObjectStrict('{invalid-json');
  assert.equal(parsed.ok, false);
  const validated = validateSemanticResponseObject(parsed.value);
  assert.equal(validated.ok, true);
  assert.equal(parsed.value.version, 'v1');
});
