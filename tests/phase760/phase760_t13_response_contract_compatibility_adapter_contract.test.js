'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { toResponseMarkdown } = require('../../src/v1/semantic/semanticResponseObject');
const { evaluateResponseContractConformance } = require('../../src/v1/semantic/responseContractConformance');

test('phase760: compatibility adapter builds response_markdown from semantic object', () => {
  const markdown = toResponseMarkdown({
    version: 'v1',
    warnings: ['注意点'],
    response_contract: {
      style: 'coach',
      intent: 'general',
      summary: '要点まとめ',
      next_steps: ['A', 'B'],
      pitfall: '注意点',
      followup_question: 'どうしますか？',
      evidence_footer: null,
      safety_notes: ['注意点']
    }
  });
  assert.ok(markdown.includes('要点まとめ'));
  assert.ok(markdown.includes('1. A'));
  assert.ok(markdown.includes('注意: 注意点'));
});

test('phase760: compatibility adapter keeps legacy response_contract while exposing canonical trace fields', () => {
  const evaluated = evaluateResponseContractConformance({
    replyText: 'SSNの準備を進めます。\n1. 書類をそろえる',
    domainIntent: 'ssn',
    stage: 'arrival',
    answerMode: 'answer',
    pathType: 'slow',
    uUnits: ['U-16', 'U-17', 'U-27'],
    quickReplies: [{ label: '必要書類', text: '必要書類を教えて' }]
  });
  assert.equal(evaluated.conformant, true);
  assert.equal(evaluated.contractVersion, 'sro_v2');
  assert.equal(evaluated.pathType, 'slow');
  assert.deepEqual(evaluated.uUnits, ['U-16', 'U-17', 'U-27']);
  assert.equal(evaluated.semanticResponseObject.response_contract.intent, 'ssn');
  assert.equal(evaluated.semanticResponseObject.service_surface, 'quick_reply');
});
