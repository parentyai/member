'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleJourneyTodoReminderJob } = require('../../src/routes/internal/journeyTodoReminderJob');
const { runJourneyTodoReminderJob } = require('../../src/usecases/journey/runJourneyTodoReminderJob');

function createResCapture() {
  const stagedHeaders = {};
  const out = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      out.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      out.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) out.body += String(chunk);
    },
    readJson() {
      return JSON.parse(out.body || '{}');
    },
    result: out
  };
}

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase653: journey reminder route enforces token guard and kill-switch', async () => {
  const restoreEnv = withEnv({ JOURNEY_JOB_TOKEN: null });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const noSecretRes = createResCapture();
    await handleJourneyTodoReminderJob({ method: 'POST', headers: {} }, noSecretRes, '{}');
    assert.equal(noSecretRes.result.statusCode, 503);

    process.env.JOURNEY_JOB_TOKEN = 'phase653_job_token';

    const unauthorizedRes = createResCapture();
    await handleJourneyTodoReminderJob({ method: 'POST', headers: {} }, unauthorizedRes, '{}');
    assert.equal(unauthorizedRes.result.statusCode, 401);

    await db.collection('system_flags').doc('phase0').set({ killSwitch: true }, { merge: true });
    const killSwitchRes = createResCapture();
    await handleJourneyTodoReminderJob({
      method: 'POST',
      headers: { 'x-journey-job-token': 'phase653_job_token' }
    }, killSwitchRes, '{}');
    assert.equal(killSwitchRes.result.statusCode, 409);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: reminder job updates reminded offsets once and avoids duplicate resend', async () => {
  const restoreEnv = withEnv({ ENABLE_JOURNEY_REMINDER_JOB: '1' });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const now = new Date('2026-02-24T00:00:00.000Z');
    const dueAt = new Date('2026-02-25T00:00:00.000Z');
    const beforeReminder = new Date('2026-02-23T23:59:00.000Z');

    await db.collection('journey_todo_items').doc('U_REM_1__visa_documents').set({
      lineUserId: 'U_REM_1',
      todoKey: 'visa_documents',
      title: '必要書類確認',
      status: 'open',
      dueDate: '2026-02-25',
      dueAt: dueAt.toISOString(),
      reminderOffsetsDays: [1],
      remindedOffsetsDays: [],
      nextReminderAt: beforeReminder.toISOString(),
      reminderCount: 0,
      updatedAt: beforeReminder.toISOString()
    }, { merge: true });

    const pushed = [];
    const policy = {
      enabled: true,
      reminder_offsets_days: [1],
      reminder_max_per_run: 100,
      paid_only_reminders: false,
      schedule_required_for_reminders: false
    };

    const first = await runJourneyTodoReminderJob({
      now: now.toISOString(),
      journeyPolicy: policy,
      dryRun: false
    }, {
      pushMessage: async (lineUserId, message) => {
        pushed.push({ lineUserId, message });
      }
    });

    assert.equal(first.ok, true);
    assert.equal(first.status, 'completed');
    assert.equal(first.scannedCount, 1);
    assert.equal(first.sentCount, 1);
    assert.equal(pushed.length, 1);

    const updated = (await db.collection('journey_todo_items').doc('U_REM_1__visa_documents').get()).data();
    assert.deepEqual(updated.remindedOffsetsDays, [1]);
    assert.equal(updated.reminderCount, 1);
    assert.equal(updated.nextReminderAt, null);

    const second = await runJourneyTodoReminderJob({
      now: now.toISOString(),
      journeyPolicy: policy,
      dryRun: false
    }, {
      pushMessage: async () => {
        throw new Error('should not push on second run');
      }
    });

    assert.equal(second.ok, true);
    assert.equal(second.scannedCount, 0);
    assert.equal(second.sentCount, 0);

    const runDocs = Object.values((db._state.collections.journey_reminder_runs || { docs: {} }).docs || {});
    assert.equal(runDocs.length, 2);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: reminder route returns partial status when push fails', async () => {
  const restoreEnv = withEnv({
    JOURNEY_JOB_TOKEN: 'phase653_job_token',
    ENABLE_JOURNEY_REMINDER_JOB: '1',
    ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1: '0',
    LINE_CHANNEL_ACCESS_TOKEN: null
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const now = new Date('2026-02-24T00:00:00.000Z');
    const dueAt = new Date('2026-02-25T00:00:00.000Z');
    const beforeReminder = new Date('2026-02-23T23:59:00.000Z');
    await db.collection('journey_todo_items').doc('U_REM_FAIL__visa_documents').set({
      lineUserId: 'U_REM_FAIL',
      todoKey: 'visa_documents',
      title: '必要書類確認',
      status: 'open',
      dueDate: '2026-02-25',
      dueAt: dueAt.toISOString(),
      reminderOffsetsDays: [1],
      remindedOffsetsDays: [],
      nextReminderAt: beforeReminder.toISOString(),
      reminderCount: 0,
      updatedAt: beforeReminder.toISOString()
    }, { merge: true });
    await db.collection('opsConfig').doc('journeyPolicy').set({
      enabled: true,
      reminder_offsets_days: [1],
      reminder_max_per_run: 100,
      paid_only_reminders: false,
      schedule_required_for_reminders: false
    }, { merge: true });

    const res = createResCapture();
    await handleJourneyTodoReminderJob({
      method: 'POST',
      headers: { 'x-journey-job-token': 'phase653_job_token' }
    }, res, JSON.stringify({
      now: now.toISOString()
    }));

    assert.equal(res.result.statusCode, 207);
    const body = res.readJson();
    assert.equal(body.ok, false);
    assert.equal(body.partialFailure, true);
    assert.equal(body.status, 'completed_with_failures');
    assert.equal(body.failedCount, 1);
    assert.equal(body.sendSummary && body.sendSummary.partialFailure, true);
    assert.equal(Number(body.sendSummary && body.sendSummary.failedCount), 1);
    assert.equal(Number(body.sendSummary && body.sendSummary.deliveredCount), 0);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_failures');
    assert.equal(res.result.headers['x-member-outcome-state'], 'partial');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
