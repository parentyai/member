'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { answerFaqFromKb } = require('../../src/usecases/faq/answerFaqFromKb');
const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

test('phase245: FAQ writes llm_disclaimer_rendered with surface=api', async () => {
  const audits = [];
  await answerFaqFromKb(
    { question: '会員番号の確認方法', traceId: 'TRACE_245_FAQ' },
    {
      env: { LLM_FEATURE_FLAG: 'false' },
      getLlmEnabled: async () => false,
      faqArticlesRepo: {
        searchActiveArticles: async () => []
      },
      appendAuditLog: async (entry) => {
        audits.push(entry);
        return { id: `a-${audits.length}` };
      }
    }
  );
  const disclaimerAudit = audits.find((entry) => entry.action === 'llm_disclaimer_rendered');
  assert.ok(disclaimerAudit);
  assert.strictEqual(disclaimerAudit.payloadSummary.purpose, 'faq');
  assert.strictEqual(disclaimerAudit.payloadSummary.surface, 'api');
});

test('phase245: Ops explain writes llm_disclaimer_rendered with surface=api', async () => {
  const audits = [];
  await getOpsExplanation(
    {
      lineUserId: 'U_PHASE245',
      traceId: 'TRACE_245_OPS',
      consoleResult: { readiness: { status: 'READY', blocking: [] } }
    },
    {
      env: { LLM_FEATURE_FLAG: 'false' },
      getLlmEnabled: async () => false,
      appendAuditLog: async (entry) => {
        audits.push(entry);
        return { id: `a-${audits.length}` };
      }
    }
  );
  const disclaimerAudit = audits.find((entry) => entry.action === 'llm_disclaimer_rendered');
  assert.ok(disclaimerAudit);
  assert.strictEqual(disclaimerAudit.payloadSummary.purpose, 'ops_explain');
  assert.strictEqual(disclaimerAudit.payloadSummary.surface, 'api');
});

test('phase245: Next actions writes llm_disclaimer_rendered with surface=api', async () => {
  const audits = [];
  await getNextActionCandidates(
    {
      lineUserId: 'U_PHASE245',
      traceId: 'TRACE_245_NEXT',
      consoleResult: { readiness: { status: 'READY', blocking: [] }, allowedNextActions: ['MONITOR'] }
    },
    {
      env: { LLM_FEATURE_FLAG: 'false' },
      getLlmEnabled: async () => false,
      appendAuditLog: async (entry) => {
        audits.push(entry);
        return { id: `a-${audits.length}` };
      }
    }
  );
  const disclaimerAudit = audits.find((entry) => entry.action === 'llm_disclaimer_rendered');
  assert.ok(disclaimerAudit);
  assert.strictEqual(disclaimerAudit.payloadSummary.purpose, 'next_actions');
  assert.strictEqual(disclaimerAudit.payloadSummary.surface, 'api');
});
