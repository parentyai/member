'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { composeConciergeReply } = require('../../src/usecases/assistant/concierge/composeConciergeReply');

test('phase717: free/paid surface keeps URL caps and emits conversation audit keys', async () => {
  const baseReplyText = '結論: ビザ更新の優先確認が必要です。\n次にやること:\n1. 期限確認\n2. 書類準備\n3. 面談予約';

  const free = await composeConciergeReply({
    question: 'visa renewal deadline',
    baseReplyText,
    userTier: 'free',
    plan: 'free',
    storedCandidates: [
      { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' },
      { url: 'https://www.state.gov/visa', sourceType: 'official', source: 'stored' }
    ],
    env: { WEB_SEARCH_PROVIDER: 'disabled' }
  });

  assert.equal(free.mode, 'B');
  assert.equal(free.auditMeta.urlCount, 1);
  assert.ok(free.replyText.includes('根拠: (source:'));
  assert.ok(free.auditMeta.conversationState);
  assert.ok(free.auditMeta.conversationMove);

  const paid = await composeConciergeReply({
    question: 'visa renewal deadline',
    baseReplyText,
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
  assert.ok(paid.auditMeta.urlCount <= 3);
  assert.ok(Number.isFinite(Number(paid.auditMeta.responseLength)));
});
