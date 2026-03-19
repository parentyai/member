'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCanonicalCoreOutboxSyncJob } = require('../../src/routes/internal/canonicalCoreOutboxSyncJob');
const { handleStructDriftBackfillJob } = require('../../src/routes/internal/structDriftBackfillJob');

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

test('phase794: canonical core outbox sync emits success dry_run outcome', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase794_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/canonical-core-outbox-sync',
      headers: {
        'x-city-pack-job-token': 'phase794_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase794_outcome'
      }
    };
    const res = createResponseRecorder();

    await handleCanonicalCoreOutboxSyncJob(req, res, JSON.stringify({ dryRun: true }), {
      runCanonicalCoreOutboxSyncJobFn: async () => ({
        ok: true,
        dryRun: true,
        scannedCount: 2,
        syncedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        items: []
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'dry_run');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_canonical_core_outbox_sync_job');
    assert.equal(res.headers['x-member-outcome-state'], 'success');
    assert.equal(res.headers['x-member-outcome-reason'], 'dry_run');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});

test('phase794: struct drift backfill emits partial outcome when more rows remain', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase794_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/struct-drift-backfill',
      headers: {
        'x-city-pack-job-token': 'phase794_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase794_struct_partial'
      }
    };
    const res = createResponseRecorder();

    await handleStructDriftBackfillJob(req, res, '{}', {
      runStructDriftBackfillFn: async () => ({
        ok: true,
        summary: {
          dryRun: false,
          changedCount: 3,
          hasMore: true,
          nextResumeAfterUserId: 'U100'
        },
        scenarioCandidates: [],
        opsStateCandidate: null
      }),
      appendAuditLogFn: async () => null
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_more_remaining');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_more_remaining');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
