'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { toBlockedReasonCategory } = require('../../src/llm/blockedReasonCategory');
const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');
const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

test('phase248: blocked reason taxonomy mapper is shared', () => {
  assert.strictEqual(toBlockedReasonCategory('kb_no_match'), 'NO_KB_MATCH');
  assert.strictEqual(toBlockedReasonCategory('low_confidence'), 'LOW_CONFIDENCE');
  assert.strictEqual(toBlockedReasonCategory('direct_url_forbidden'), 'DIRECT_URL_DETECTED');
  assert.strictEqual(toBlockedReasonCategory('warn_link_blocked'), 'WARN_LINK_BLOCKED');
  assert.strictEqual(toBlockedReasonCategory('consent_missing'), 'CONSENT_MISSING');
});

test('phase248: FAQ audit stores regulatoryProfile', async () => {
  const audits = [];
  await answerFaqFromKb(
    { question: '会員番号の確認方法', traceId: 'TRACE_248_FAQ' },
    {
      env: { LLM_FEATURE_FLAG: 'true' },
      getLlmEnabled: async () => true,
      getLlmPolicy: async () => ({ lawfulBasis: 'consent', consentVerified: false, crossBorder: true }),
      faqArticlesRepo: { searchActiveArticles: async () => [] },
      appendAuditLog: async (entry) => {
        audits.push(entry);
        return { id: `a-${audits.length}` };
      }
    }
  );
  const blocked = audits.find((entry) => entry.action === 'llm_faq_answer_blocked');
  assert.ok(blocked);
  assert.ok(blocked.payloadSummary.regulatoryProfile);
  assert.strictEqual(blocked.payloadSummary.regulatoryProfile.lawfulBasis, 'consent');
  assert.strictEqual(blocked.payloadSummary.regulatoryProfile.blockedReasonCategory, 'CONSENT_MISSING');
});

test('phase248: Ops/NextAction audits include regulatoryProfile', async () => {
  const audits = [];
  const appendAuditLog = async (entry) => {
    audits.push(entry);
    return { id: `a-${audits.length}` };
  };

  await getOpsExplanation(
    { lineUserId: 'U_PHASE248', traceId: 'TRACE_248_OPS', consoleResult: { readiness: { status: 'READY', blocking: [] } } },
    { env: { LLM_FEATURE_FLAG: 'false' }, getLlmEnabled: async () => false, appendAuditLog }
  );
  await getNextActionCandidates(
    { lineUserId: 'U_PHASE248', traceId: 'TRACE_248_NEXT', consoleResult: { readiness: { status: 'READY', blocking: [] }, allowedNextActions: ['MONITOR'] } },
    { env: { LLM_FEATURE_FLAG: 'false' }, getLlmEnabled: async () => false, appendAuditLog }
  );

  const opsAudit = audits.find((entry) => entry.action === 'llm_ops_explain_blocked');
  const nextAudit = audits.find((entry) => entry.action === 'llm_next_actions_blocked');
  assert.ok(opsAudit && opsAudit.payloadSummary.regulatoryProfile);
  assert.ok(nextAudit && nextAudit.payloadSummary.regulatoryProfile);
  assert.strictEqual(opsAudit.payloadSummary.regulatoryProfile.policySnapshotVersion, 'llm_policy_v1');
  assert.strictEqual(nextAudit.payloadSummary.regulatoryProfile.policySnapshotVersion, 'llm_policy_v1');
});
