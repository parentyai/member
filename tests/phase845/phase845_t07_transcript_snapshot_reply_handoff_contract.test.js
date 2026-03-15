'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  resolveTranscriptSnapshotAssistantReplyText
} = require('../../src/routes/webhookLine');

test('phase845: transcript snapshot reply handoff prefers explicit final reply text', () => {
  const replyText = resolveTranscriptSnapshotAssistantReplyText({
    replyText: '',
    finalReplyText: '最終返信です。',
    qualityMeta: { replyTextLineage: '品質メタ返信' },
    responseContractConformance: { responseMarkdown: '整形返信' }
  });

  assert.equal(replyText, '最終返信です。');
});

test('phase845: transcript snapshot reply handoff prefers conversation quality lineage before response contract markdown', () => {
  const replyText = resolveTranscriptSnapshotAssistantReplyText({
    replyText: '',
    finalReplyText: '',
    qualityMeta: { replyTextLineage: '品質メタ返信' },
    responseContractConformance: { responseMarkdown: '実送信された返信' }
  });

  assert.equal(replyText, '品質メタ返信');
});

test('phase845: transcript snapshot reply handoff falls back to response contract markdown when higher-priority sources are absent', () => {
  const replyText = resolveTranscriptSnapshotAssistantReplyText({
    replyText: '',
    finalReplyText: '',
    qualityMeta: {},
    responseContractConformance: { responseMarkdown: '実送信された返信' }
  });

  assert.equal(replyText, '実送信された返信');
});

test('phase845: transcript snapshot reply handoff keeps assistant reply missing when every source is absent', () => {
  const replyText = resolveTranscriptSnapshotAssistantReplyText({
    replyText: '',
    finalReplyText: '',
    qualityMeta: {},
    responseContractConformance: {}
  });

  assert.equal(replyText, '');
});
