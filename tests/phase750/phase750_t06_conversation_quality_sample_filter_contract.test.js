'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase750: conversation quality summary excludes non-conversation rows and treats missing telemetry as unknown', () => {
  const summary = buildConversationQualitySummary([
    {
      entryType: 'job',
      strategy: 'none',
      routerReason: 'none'
    },
    {
      entryType: 'webhook',
      conversationMode: 'concierge',
      routerReason: 'contextual_domain_resume',
      followupIntent: 'docs_required',
      directAnswerApplied: true,
      conciseModeApplied: true,
      repetitionPrevented: true,
      clarifySuppressed: true,
      followupQuestionIncluded: true,
      pitfallIncluded: true,
      contextCarryScore: 0.8,
      repeatRiskScore: 0.2
    },
    {
      entryType: 'webhook',
      conversationMode: 'concierge',
      routerReason: 'contextual_domain_resume',
      followupIntent: 'next_step',
      contextCarryScore: 0.7,
      repeatRiskScore: 0.1
    }
  ]);

  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.directAnswerAppliedRate, 1);
  assert.equal(summary.conciseModeAppliedRate, 1);
  assert.equal(summary.repetitionPreventedRate, 1);
  assert.equal(summary.clarifySuppressedRate, 1);
  assert.equal(summary.defaultCasualRate, 0);
  assert.equal(summary.followupQuestionIncludedRate, 1);
  assert.equal(summary.pitfallIncludedRate, 1);
});

