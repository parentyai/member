'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { toResponseMarkdown } = require('../../src/v1/semantic/semanticResponseObject');

test('phase760: compatibility adapter builds response_markdown from semantic object', () => {
  const markdown = toResponseMarkdown({
    version: 'v1',
    response_contract: {
      style: 'coach',
      intent: 'general',
      summary: '要点まとめ',
      next_steps: ['A', 'B'],
      pitfall: '注意点',
      followup_question: 'どうしますか？',
      evidence_footer: null,
      safety_notes: []
    }
  });
  assert.ok(markdown.includes('要点まとめ'));
  assert.ok(markdown.includes('1. A'));
  assert.ok(markdown.includes('注意: 注意点'));
});
