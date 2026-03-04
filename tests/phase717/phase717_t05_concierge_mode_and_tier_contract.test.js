'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

test('phase717: free and paid keep mode policy and URL caps with style metadata', async () => {
  const free = await composeConciergeReply({
    question: 'visa renewal deadline',
    baseReplyText: '期限確認が必要です。\n1. 期限を確認\n2. 書類を準備',
    userTier: 'free',
    plan: 'free',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' },
      { url: 'https://www.state.gov/visa', sourceType: 'official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(free.mode, 'B');
  assert.equal(free.auditMeta.userTier, 'free');
  assert.equal(free.auditMeta.urlCount, 1);
  assert.ok(free.auditMeta.styleId);

  const paid = await composeConciergeReply({
    question: 'visa renewal deadline',
    baseReplyText: '期限確認が必要です。\n1. 期限を確認\n2. 書類を準備',
    userTier: 'paid',
    plan: 'pro',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' },
      { url: 'https://www.state.gov/visa', sourceType: 'official', source: 'stored' },
      { url: 'https://www.cdc.gov/health', sourceType: 'semi_official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(paid.mode, 'B');
  assert.equal(paid.auditMeta.userTier, 'paid');
  assert.ok(paid.auditMeta.urlCount >= 1);
  assert.ok(paid.auditMeta.urlCount <= 3);
});
