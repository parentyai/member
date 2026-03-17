'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleTaskNudgeJob } = require('../../src/routes/internal/taskNudgeJob');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      Object.entries(headers || {}).forEach(([name, value]) => {
        this.headers[String(name).toLowerCase()] = String(value);
      });
    },
    end(text) {
      this.body = typeof text === 'string' ? text : '';
    }
  };
}

test('phase825: task nudge route emits blocked outcome when feature is disabled', async () => {
  const prevToken = process.env.TASK_JOB_TOKEN;
  const prevFlag = process.env.ENABLE_TASK_NUDGE_V1;
  process.env.TASK_JOB_TOKEN = 'phase825_task_job_token';
  process.env.ENABLE_TASK_NUDGE_V1 = '0';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/task-nudge',
      headers: {
        'x-task-job-token': 'phase825_task_job_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleTaskNudgeJob(req, res, '{}', {
      getKillSwitch: async () => false
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'disabled_by_env');
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'disabled_by_env');
    assert.equal(res.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.headers['x-member-outcome-reason'], 'disabled_by_env');
  } finally {
    if (prevToken === undefined) delete process.env.TASK_JOB_TOKEN;
    else process.env.TASK_JOB_TOKEN = prevToken;
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_NUDGE_V1;
    else process.env.ENABLE_TASK_NUDGE_V1 = prevFlag;
  }
});

test('phase825: task nudge route emits partial outcome when notifications fail after scan', async () => {
  const prevToken = process.env.TASK_JOB_TOKEN;
  process.env.TASK_JOB_TOKEN = 'phase825_task_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/task-nudge',
      headers: {
        'x-task-job-token': 'phase825_task_job_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleTaskNudgeJob(req, res, '{}', {
      getKillSwitch: async () => false,
      runTaskNudgeJob: async () => ({
        ok: false,
        status: 'completed',
        now: '2026-03-17T00:00:00.000Z',
        dryRun: false,
        scannedCount: 2,
        sentCount: 1,
        skippedCount: 0,
        failedCount: 1,
        results: [{ taskId: 'task_1', status: 'failed', error: 'send failed' }]
      })
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_failures');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_failures');
  } finally {
    if (prevToken === undefined) delete process.env.TASK_JOB_TOKEN;
    else process.env.TASK_JOB_TOKEN = prevToken;
  }
});
