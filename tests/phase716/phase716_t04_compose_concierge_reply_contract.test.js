'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

function countSourceLines(text) {
  return (String(text || '').match(/\(source:/g) || []).length;
}

test('phase716: Mode A never appends URLs even when candidates exist', async () => {
  const result = await composeConciergeReply({
    question: 'organize weekly schedule',
    baseReplyText: 'general guidance',
    userTier: 'paid',
    plan: 'pro',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(result.mode, 'A');
  assert.equal(result.auditMeta.urlCount, 0);
  assert.equal(countSourceLines(result.replyText), 0);
});

test('phase716: free Mode B caps URL count to 1 and excludes disallowed ranks', async () => {
  const result = await composeConciergeReply({
    question: 'visa renewal deadline',
    baseReplyText: 'visa guidance',
    userTier: 'free',
    plan: 'free',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' },
      { url: 'https://www.reuters.com/world', sourceType: 'other', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(result.mode, 'B');
  assert.equal(result.auditMeta.userTier, 'free');
  assert.equal(result.auditMeta.urlCount, 1);
  assert.equal(countSourceLines(result.replyText), 1);
  assert.deepEqual(result.auditMeta.citationRanks, ['R0']);
});

test('phase716: paid Mode C can append up to 3 URLs', async () => {
  const result = await composeConciergeReply({
    question: 'weekend activity ideas',
    baseReplyText: 'activity guidance',
    userTier: 'paid',
    plan: 'pro',
    storedCandidates: [
      { url: 'https://www.nyc.gov/events', sourceType: 'official', source: 'stored' },
      { url: 'https://www.reuters.com/world', sourceType: 'other', source: 'stored' },
      { url: 'https://www.un.org/en', sourceType: 'semi_official', source: 'stored' },
      { url: 'https://www.apnews.com/article', sourceType: 'other', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(result.mode, 'C');
  assert.equal(result.auditMeta.userTier, 'paid');
  assert.ok(result.auditMeta.urlCount <= 3);
  assert.equal(result.auditMeta.urlCount, countSourceLines(result.replyText));
  assert.ok(result.auditMeta.urlCount >= 1);
});
