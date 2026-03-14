'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectAndUpsertQualityIssues } = require('../../src/usecases/qualityPatrol/detectAndUpsertQualityIssues');
const { evaluateReviewUnit, buildKpiResultFromEntries } = require('./phase850_helpers');

test('phase850: detectAndUpsertQualityIssues reuses registry and backlog foundations without issue explosion', async () => {
  const broad = evaluateReviewUnit({
    reviewUnitId: 'review_unit_phase850_registry',
    slice: 'broad',
    userMessage: { text: '移住で何から？', available: true },
    assistantReply: { text: '一般的には状況によります。まずは次の一手です。', available: true },
    telemetrySignals: {
      strategyReason: 'broad_question',
      selectedCandidateKind: 'domain_concierge_candidate',
      fallbackTemplateKind: 'generic_fallback',
      finalizerTemplateKind: 'generic_fallback',
      genericFallbackSlice: 'broad',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      groundedCandidateAvailable: false,
      cityPackCandidateAvailable: false,
      cityPackUsedInAnswer: false,
      savedFaqCandidateAvailable: false,
      savedFaqUsedInAnswer: false,
      replyTemplateFingerprint: 'reply_fp_phase850_registry',
      repeatRiskScore: 0.81,
      committedNextActions: []
    }
  });
  const kpiResult = buildKpiResultFromEntries([broad]);
  const issueStore = new Map();
  const backlogStore = new Map();
  const deps = {
    qualityIssueRegistryRepo: {
      async upsertQualityIssue(record) {
        const created = !issueStore.has(record.issueId);
        issueStore.set(record.issueId, record);
        return { id: record.issueId, created, issueFingerprint: record.issueFingerprint, occurrenceCount: record.occurrenceCount };
      }
    },
    improvementBacklogRepo: {
      async upsertImprovementBacklog(record) {
        const created = !backlogStore.has(record.backlogId);
        backlogStore.set(record.backlogId, record);
        return { id: record.backlogId, created };
      }
    }
  };

  const first = await detectAndUpsertQualityIssues({ kpiResult, persist: true }, deps);
  const second = await detectAndUpsertQualityIssues({ kpiResult, persist: true }, deps);

  assert.ok(first.persisted);
  assert.equal(issueStore.size, first.issueCandidates.length);
  assert.equal(issueStore.size, second.issueCandidates.length);
  assert.ok(backlogStore.size >= 1);
});
