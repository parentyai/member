'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyBranchDispatchJob } = require('../../src/routes/internal/journeyBranchDispatchJob');

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

test('phase664: journey branch dispatch route emits blocked outcome when flag disables dispatch', async () => {
  const prevToken = process.env.JOURNEY_BRANCH_JOB_TOKEN;
  const prevFlag = process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
  process.env.JOURNEY_BRANCH_JOB_TOKEN = 'phase664_branch_token';
  process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1 = '0';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/journey-branch-dispatch',
      headers: {
        'x-journey-branch-job-token': 'phase664_branch_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleJourneyBranchDispatchJob(req, res, '{}', {
      getKillSwitch: async () => false
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'disabled_by_flag');
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'disabled_by_flag');
    assert.equal(res.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.headers['x-member-outcome-reason'], 'disabled_by_flag');
  } finally {
    if (prevToken === undefined) delete process.env.JOURNEY_BRANCH_JOB_TOKEN;
    else process.env.JOURNEY_BRANCH_JOB_TOKEN = prevToken;
    if (prevFlag === undefined) delete process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
    else process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1 = prevFlag;
  }
});

test('phase664: journey branch dispatch route emits partial outcome for skipped items', async () => {
  const prevToken = process.env.JOURNEY_BRANCH_JOB_TOKEN;
  const prevFlag = process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
  process.env.JOURNEY_BRANCH_JOB_TOKEN = 'phase664_branch_token';
  process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1 = '1';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/journey-branch-dispatch',
      headers: {
        'x-journey-branch-job-token': 'phase664_branch_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleJourneyBranchDispatchJob(req, res, '{}', {
      getKillSwitch: async () => false,
      runJourneyBranchDispatchJob: async () => ({
        ok: true,
        status: 'completed',
        dryRun: false,
        scannedCount: 3,
        sentCount: 1,
        skippedCount: 2,
        failedCount: 0,
        items: []
      })
    });

    const body = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_skips');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_skips');
  } finally {
    if (prevToken === undefined) delete process.env.JOURNEY_BRANCH_JOB_TOKEN;
    else process.env.JOURNEY_BRANCH_JOB_TOKEN = prevToken;
    if (prevFlag === undefined) delete process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
    else process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1 = prevFlag;
  }
});
