'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function buildBaseDeps(audits) {
  return {
    userJourneySchedulesRepo: {
      getUserJourneySchedule: async () => ({ departureDate: '2026-04-01', assignmentDate: null }),
      upsertUserJourneySchedule: async (_lineUserId, patch) => Object.assign({ id: 'schedule_1' }, patch)
    },
    appendAuditLog: async (entry) => {
      audits.push(entry);
      return { id: `audit_${audits.length}` };
    }
  };
}

test('phase250: assignment date update writes recompute enqueued/completed audit with traceId', async () => {
  const audits = [];
  const deps = buildBaseDeps(audits);
  deps.syncJourneyTodoPlan = async () => ({ syncedCount: 4 });
  deps.syncUserTasksProjection = async () => ({ ok: true });

  const result = await handleJourneyLineCommand({
    lineUserId: 'U_PHASE250_ASSIGN',
    text: '着任日:2026-04-08',
    traceId: 'trace_phase250_assignment_ok',
    requestId: 'req_phase250_assignment_ok',
    actor: 'phase250_assignment_test'
  }, deps);

  assert.strictEqual(result.handled, true);
  assert.match(result.replyText, /着任日を 2026-04-08 に更新しました/);
  const actions = audits.map((entry) => entry && entry.action);
  assert.ok(actions.includes('journey.assignment_recompute.enqueued'));
  assert.ok(actions.includes('journey.assignment_recompute.completed'));
  const completed = audits.find((entry) => entry && entry.action === 'journey.assignment_recompute.completed');
  assert.strictEqual(completed.traceId, 'trace_phase250_assignment_ok');
  assert.strictEqual(completed.requestId, 'req_phase250_assignment_ok');
  assert.strictEqual(completed.payloadSummary.assignmentDate, '2026-04-08');
  assert.strictEqual(completed.payloadSummary.syncedCount, 4);
});

test('phase250: assignment date recompute failure writes failed audit evidence', async () => {
  const audits = [];
  const deps = buildBaseDeps(audits);
  deps.syncJourneyTodoPlan = async () => {
    throw new Error('sync_failed');
  };

  await assert.rejects(async () => {
    await handleJourneyLineCommand({
      lineUserId: 'U_PHASE250_ASSIGN',
      text: '着任日:2026-04-08',
      traceId: 'trace_phase250_assignment_failed',
      requestId: 'req_phase250_assignment_failed',
      actor: 'phase250_assignment_test'
    }, deps);
  }, /sync_failed/);

  const actions = audits.map((entry) => entry && entry.action);
  assert.ok(actions.includes('journey.assignment_recompute.enqueued'));
  assert.ok(actions.includes('journey.assignment_recompute.failed'));
  const failed = audits.find((entry) => entry && entry.action === 'journey.assignment_recompute.failed');
  assert.strictEqual(failed.traceId, 'trace_phase250_assignment_failed');
  assert.strictEqual(failed.requestId, 'req_phase250_assignment_failed');
  assert.strictEqual(failed.payloadSummary.error, 'sync_failed');
});
