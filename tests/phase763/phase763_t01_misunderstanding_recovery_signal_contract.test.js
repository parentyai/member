'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPaidConversationOrchestrator } = require('../../src/domain/llm/orchestrator/runPaidConversationOrchestrator');
const {
  buildConversationQualitySummary,
  buildQualityFrameworkSummary
} = require('../../src/routes/admin/osLlmUsageSummary');

test('phase763: orchestrator marks misunderstandingRecovered when recovery signal is handled', async () => {
  const result = await runPaidConversationOrchestrator({
    lineUserId: 'U_PHASE763_RECOVERY',
    messageText: '違う、予約じゃなくて必要書類',
    paidIntent: 'situation_analysis',
    planInfo: { plan: 'pro', status: 'active' },
    routerMode: 'casual',
    llmFlags: {
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: false,
      qualityEnabled: true,
      snapshotStrictMode: false
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'appointment_needed',
        replyText: 'SSN窓口の予約要否を先に確認しましょう。'
      }
    ],
    deps: {
      generatePaidCasualReply: () => ({ replyText: '了解です。' }),
      generateGroundedReply: async () => ({ ok: false, blockedReason: 'not_used' }),
      generateDomainConciergeCandidate: async () => ({ ok: false, blockedReason: 'not_used' })
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.packet.recoverySignal, true);
  assert.equal(result.telemetry.directAnswerApplied, true);
  assert.equal(result.telemetry.misunderstandingRecovered, true);
});

test('phase763: quality framework misunderstanding_recovery dimension increases with misunderstandingRecovered signal', () => {
  const baseRows = [
    {
      entryType: 'webhook',
      conversationMode: 'concierge',
      routerReason: 'contextual_domain_resume',
      strategy: 'domain_concierge',
      domainIntent: 'ssn',
      followupIntent: 'docs_required',
      directAnswerApplied: true,
      clarifySuppressed: true,
      conciseModeApplied: true,
      repetitionPrevented: true,
      contextCarryScore: 0.82,
      repeatRiskScore: 0.22,
      recoverySignal: true,
      followupCarryFromHistory: true,
      retrieveNeeded: false,
      contradictionDetected: false
    }
  ];

  const withRecovered = baseRows.map((row) => Object.assign({}, row, { misunderstandingRecovered: true }));
  const withoutRecovered = baseRows.map((row) => Object.assign({}, row, { misunderstandingRecovered: false }));

  const summaryWithRecovered = buildConversationQualitySummary(withRecovered);
  const summaryWithoutRecovered = buildConversationQualitySummary(withoutRecovered);

  assert.equal(summaryWithRecovered.misunderstandingRecoveredRate, 1);
  assert.equal(summaryWithoutRecovered.misunderstandingRecoveredRate, 0);

  const qualityWithRecovered = buildQualityFrameworkSummary({
    conversationQuality: summaryWithRecovered,
    gateAuditBaseline: { acceptedRate: 0.95, blockedReasons: [], callsTotal: 1 },
    optimization: { compatShareWindow: 0.05 },
    releaseReadiness: { metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { plans: [] },
    actionRows: withRecovered,
    baselineOverallScore: 54.9
  });
  const qualityWithoutRecovered = buildQualityFrameworkSummary({
    conversationQuality: summaryWithoutRecovered,
    gateAuditBaseline: { acceptedRate: 0.95, blockedReasons: [], callsTotal: 1 },
    optimization: { compatShareWindow: 0.05 },
    releaseReadiness: { metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { plans: [] },
    actionRows: withoutRecovered,
    baselineOverallScore: 54.9
  });

  const getDimension = (summary, key) => {
    const rows = Array.isArray(summary.dimensions) ? summary.dimensions : [];
    const hit = rows.find((row) => row && row.key === key);
    return hit ? Number(hit.score) : 0;
  };

  const recoveredScore = getDimension(qualityWithRecovered, 'misunderstanding_recovery');
  const withoutRecoveredScore = getDimension(qualityWithoutRecovered, 'misunderstanding_recovery');

  assert.equal(recoveredScore > withoutRecoveredScore, true);
});
