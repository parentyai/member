'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleLlmActionRewardFinalizeJob } = require('../../src/routes/internal/llmActionRewardFinalizeJob');
const { handleEmergencyJobs } = require('../../src/routes/internal/emergencyJobs');

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

test('phase716: llm reward finalize emits partial outcome when finalize finishes with errors', async () => {
  const prevToken = process.env.LLM_ACTION_JOB_TOKEN;
  process.env.LLM_ACTION_JOB_TOKEN = 'phase716_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/llm-action-reward-finalize',
      headers: {
        'x-llm-action-job-token': 'phase716_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase716_partial'
      }
    };
    const res = createResponseRecorder();

    await handleLlmActionRewardFinalizeJob(req, res, '{}', {
      enforceLlmGenerationKillSwitchFn: async () => true,
      finalizeLlmActionRewardsFn: async () => ({
        ok: true,
        dryRun: false,
        processed: 2,
        updated: 1,
        skipped: 0,
        errors: 1,
        details: []
      }),
      appendLlmGateDecisionFn: async () => null
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_errors');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_llm_action_reward_finalize_job');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_errors');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    if (prevToken === undefined) delete process.env.LLM_ACTION_JOB_TOKEN;
    else process.env.LLM_ACTION_JOB_TOKEN = prevToken;
  }
});

test('phase716: llm reward finalize returns not_found outcome for method mismatch', async () => {
  const res = createResponseRecorder();

  await handleLlmActionRewardFinalizeJob({
    method: 'GET',
    url: '/internal/jobs/llm-action-reward-finalize',
    headers: {}
  }, res, '', {
    enforceLlmGenerationKillSwitchFn: async () => true,
    finalizeLlmActionRewardsFn: async () => null,
    appendLlmGateDecisionFn: async () => null
  });

  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'not_found');
  assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_llm_action_reward_finalize_job');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.decision, 'block');
  assert.equal(res.headers['x-member-outcome-state'], 'error');
  assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  assert.equal(res.headers['x-member-outcome-reason'], 'not_found');
});

test('phase716: llm reward finalize attaches route metadata on token guard failure', async () => {
  const prevToken = process.env.LLM_ACTION_JOB_TOKEN;
  delete process.env.LLM_ACTION_JOB_TOKEN;
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/llm-action-reward-finalize',
      headers: {
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleLlmActionRewardFinalizeJob(req, res, '{}', {
      enforceLlmGenerationKillSwitchFn: async () => true,
      finalizeLlmActionRewardsFn: async () => null,
      appendLlmGateDecisionFn: async () => null
    });

    assert.equal(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'job_token_not_configured');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_llm_action_reward_finalize_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.decision, 'block');
    assert.equal(res.headers['x-member-outcome-state'], 'error');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
    assert.equal(res.headers['x-member-outcome-reason'], 'job_token_not_configured');
  } finally {
    if (prevToken === undefined) delete process.env.LLM_ACTION_JOB_TOKEN;
    else process.env.LLM_ACTION_JOB_TOKEN = prevToken;
  }
});

test('phase716: emergency sync emits partial outcome headers when provider run partially fails', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase716_city_pack_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/emergency-sync',
      headers: {
        'x-city-pack-job-token': 'phase716_city_pack_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleEmergencyJobs(req, res, '{}', {
      getKillSwitch: async () => false,
      runEmergencySync: async () => ({
        ok: false,
        partialFailure: true,
        reason: 'completed_with_failures'
      })
    });

    assert.equal(res.statusCode, 207);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_failures');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_emergency_sync_job');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_failures');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});

test('phase716: emergency handler returns not_found outcome for unknown route in direct execution', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase716_city_pack_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/emergency-unknown',
      headers: {
        'x-city-pack-job-token': 'phase716_city_pack_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleEmergencyJobs(req, res, '{}', {
      getKillSwitch: async () => false
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_emergency_jobs');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
