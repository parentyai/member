'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runTaskNudgeJob } = require('../../src/usecases/tasks/runTaskNudgeJob');
const { handleTaskNudgeJob } = require('../../src/routes/internal/taskNudgeJob');
const { handleEmergencyJobs } = require('../../src/routes/internal/emergencyJobs');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = Object.assign({}, headers || {});
    },
    end(text) {
      this.body = typeof text === 'string' ? text : '';
    }
  };
}

test('phase825: runTaskNudgeJob fail-closes on kill-switch read failure', async () => {
  const prevNudge = process.env.ENABLE_TASK_NUDGE_V1;
  process.env.ENABLE_TASK_NUDGE_V1 = '1';
  try {
    const result = await runTaskNudgeJob({
      dryRun: true,
      now: '2026-03-08T00:00:00.000Z'
    }, {
      getKillSwitch: async () => {
        throw new Error('system_flags unavailable');
      }
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 'blocked_by_killswitch_read_failed');
    assert.equal(result.reason, 'kill_switch_read_failed');
  } finally {
    if (prevNudge === undefined) delete process.env.ENABLE_TASK_NUDGE_V1;
    else process.env.ENABLE_TASK_NUDGE_V1 = prevNudge;
  }
});

test('phase825: task nudge route returns 503 when usecase reports kill-switch read failure', async () => {
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
        status: 'blocked_by_killswitch_read_failed',
        reason: 'kill_switch_read_failed'
      })
    });

    assert.equal(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'blocked_by_killswitch_read_failed');
  } finally {
    if (prevToken === undefined) delete process.env.TASK_JOB_TOKEN;
    else process.env.TASK_JOB_TOKEN = prevToken;
  }
});

test('phase825: emergency internal route maps failed outcomes to non-200 status', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase825_city_pack_job_token';
  try {
    const reqBase = {
      method: 'POST',
      url: '/internal/jobs/emergency-sync',
      headers: {
        'x-city-pack-job-token': 'phase825_city_pack_job_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };

    const blockedRes = createResponseRecorder();
    await handleEmergencyJobs(reqBase, blockedRes, '{}', {
      getKillSwitch: async () => false,
      runEmergencySync: async () => ({ ok: false, blocked: true, reason: 'kill_switch_on' })
    });
    assert.equal(blockedRes.statusCode, 409);

    const partialRes = createResponseRecorder();
    await handleEmergencyJobs(reqBase, partialRes, '{}', {
      getKillSwitch: async () => false,
      runEmergencySync: async () => ({ ok: false, partialFailure: true, reason: 'completed_with_failures' })
    });
    assert.equal(partialRes.statusCode, 207);

    const errorRes = createResponseRecorder();
    await handleEmergencyJobs(reqBase, errorRes, '{}', {
      getKillSwitch: async () => false,
      runEmergencySync: async () => ({ ok: false, reason: 'upstream_failed' })
    });
    assert.equal(errorRes.statusCode, 500);
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
