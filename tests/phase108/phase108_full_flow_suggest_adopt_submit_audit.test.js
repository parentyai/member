'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');
const { appendLlmAdoptAudit } = require('../../src/usecases/phase105/appendLlmAdoptAudit');

function buildDeps(auditCapture) {
  return {
    getOpsAssistContext: async ({ lineUserId }) => ({
      decisionTimeline: [],
      constraints: { readiness: 'READY', allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE'] },
      opsConsoleSnapshot: {
        readiness: { status: 'READY', blocking: [] },
        opsState: { nextAction: 'NO_ACTION' },
        latestDecisionLog: { id: `d-${lineUserId}` },
        userStateSummary: { registrationCompleteness: { ok: true } },
        memberSummary: { member: { hasMemberNumber: true, memberNumberStale: false } },
        allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE']
      }
    }),
    opsAssistCacheRepo: {
      getLatestOpsAssistCache: async () => null
    },
    decisionTimelineRepo: null,
    appendLlmSuggestionAudit: async (payload) => {
      auditCapture.push({ eventType: 'LLM_SUGGESTION', payload });
      return { id: `a-${auditCapture.length}` };
    }
  };
}

test('phase108: suggest -> adopt -> submit audit flow', async () => {
  const auditCapture = [];
  const deps = buildDeps(auditCapture);

  const viewReady = {
    readiness: { status: 'READY', blocking: [] },
    opsState: { nextAction: 'NO_ACTION' },
    latestDecisionLog: { id: 'd1', nextAction: 'NO_ACTION' },
    userStateSummary: { registrationCompleteness: { ok: true } },
    memberSummary: { member: { hasMemberNumber: true, memberNumberStale: false } },
    allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE']
  };

  const suggestionReady = await getOpsAssistSuggestion({ lineUserId: 'U1', opsConsoleView: viewReady }, deps);
  assert.strictEqual(suggestionReady.safety.status, 'OK');

  const adoptAudit = [];
  await appendLlmAdoptAudit({
    lineUserId: 'U1',
    decisionLogId: 'd1',
    adoptedAction: suggestionReady.suggestion.nextAction,
    suggestion: suggestionReady.suggestion
  }, {
    auditLogsRepo: {
      appendAuditLog: async (entry) => {
        adoptAudit.push(entry);
        return { id: 'ad1' };
      }
    }
  });

  assert.ok(adoptAudit.length === 1);
  assert.strictEqual(adoptAudit[0].eventType, 'LLM_SUGGESTION_ADOPTED');

  const viewNotReady = Object.assign({}, viewReady, {
    readiness: { status: 'NOT_READY', blocking: ['x'] },
    allowedNextActions: ['STOP_AND_ESCALATE']
  });
  const suggestionNotReady = await getOpsAssistSuggestion({ lineUserId: 'U2', opsConsoleView: viewNotReady }, deps);
  assert.strictEqual(suggestionNotReady.suggestion.nextAction, 'STOP_AND_ESCALATE');

  const viewBlocked = Object.assign({}, viewReady, {
    readiness: { status: 'NOT_READY', blocking: ['x'] },
    allowedNextActions: ['NO_ACTION']
  });
  const suggestionBlocked = await getOpsAssistSuggestion({ lineUserId: 'U3', opsConsoleView: viewBlocked }, deps);
  assert.strictEqual(suggestionBlocked.safety.status, 'BLOCK');
  assert.ok(auditCapture.length >= 3);
});
