'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase791: DATA-C-02 registry status is aligned', () => {
  const registry = JSON.parse(fs.readFileSync('contracts/llm_spec_contract_registry.v2.json', 'utf8'));
  const row = registry.requirements.find((item) => item && item.requirementId === 'DATA-C-02');
  assert.ok(row, 'DATA-C-02 must exist');
  assert.equal(row.status, 'aligned');
  assert.match(String(row.recommendedAction || ''), /enforced-mode compliance gate/i);
});

test('phase791: DATA_HANDLING_ENVELOPE_POLICY_V2 marks target classes as enforced', () => {
  const doc = fs.readFileSync('docs/DATA_HANDLING_ENVELOPE_POLICY_V2.md', 'utf8');
  [
    '| llm_action_logs | enforced |',
    '| llm_quality_logs | enforced |',
    '| faq_answer_logs | enforced |',
    '| source_refs | enforced |',
    '| memory_* | enforced |',
    '| delivery_records | enforced |',
    '| liff_synthetic_events | enforced |'
  ].forEach((needle) => {
    assert.ok(doc.includes(needle), `policy doc must include enforced row: ${needle}`);
  });
  assert.match(doc, /ENABLE_DATA_ENVELOPE_ENFORCED_V1/);
});

