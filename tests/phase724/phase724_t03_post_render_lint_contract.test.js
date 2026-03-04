'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { lintConciergeText } = require('../../src/domain/llm/conversation/postRenderSafetyLint');

test('phase724: post-render lint removes direct URL text and caps source rows', () => {
  const lint = lintConciergeText({
    text: [
      'これは必ず完了します。',
      'https://example.com/path',
      '根拠: (source: a.gov/a), (source: b.gov/b), (source: c.gov/c), (source: d.gov/d)'
    ].join('\n'),
    topic: 'regulation',
    maxUrls: 3
  });

  assert.equal(lint.modified, true);
  assert.ok(lint.findings.includes('direct_url_removed'));
  assert.ok(lint.findings.includes('certainty_softened'));
  assert.ok(lint.findings.includes('source_capped'));
  assert.ok(!lint.text.includes('https://'));

  const sourceCount = (lint.text.match(/\(source:/g) || []).length;
  assert.equal(sourceCount, 3);
});
