'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase719: conversation quality summary aggregates naturalness and domain concierge rate', () => {
  const summary = buildConversationQualitySummary([
    {
      legacyTemplateHit: false,
      followupQuestionIncluded: true,
      pitfallIncluded: true,
      actionCount: 3,
      domainIntent: 'housing',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge'
    },
    {
      legacyTemplateHit: false,
      followupQuestionIncluded: false,
      pitfallIncluded: true,
      actionCount: 2,
      domainIntent: 'school',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge_fallback'
    },
    {
      legacyTemplateHit: true,
      followupQuestionIncluded: false,
      pitfallIncluded: false,
      actionCount: 0,
      domainIntent: 'general',
      conversationMode: 'casual',
      fallbackType: 'free_retrieval_sanitized'
    }
  ]);

  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.conversationNaturalnessVersion, 'v1');
  assert.equal(summary.legacyTemplateHitRate, 0.3333);
  assert.equal(summary.followupQuestionIncludedRate, 0.3333);
  assert.equal(summary.pitfallIncludedRate, 0.6667);
  assert.equal(summary.avgActionCount, 1.6667);
  assert.equal(summary.domainIntentConciergeRate, 1);
  assert.ok(Array.isArray(summary.domainIntents));
  assert.ok(Array.isArray(summary.fallbackTypes));
});

test('phase719: llm action log schema includes conversation quality metadata fields', () => {
  const repo = read('src/repos/firestore/llmActionLogsRepo.js');
  [
    'conversationNaturalnessVersion',
    'legacyTemplateHit',
    'followupQuestionIncluded',
    'actionCount',
    'pitfallIncluded',
    'domainIntent',
    'fallbackType',
    'interventionSuppressedBy'
  ].forEach((token) => {
    assert.ok(repo.includes(token), token);
  });

  const usageSummary = read('src/routes/admin/osLlmUsageSummary.js');
  assert.ok(usageSummary.includes('buildConversationQualitySummary'));
  assert.ok(usageSummary.includes('conversationQuality'));
});
