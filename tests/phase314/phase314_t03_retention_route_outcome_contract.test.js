'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleRetentionDryRunJob } = require('../../src/routes/internal/retentionDryRunJob');
const { handleRetentionApplyJob } = require('../../src/routes/internal/retentionApplyJob');

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

function createDbStub(docsByCollection) {
  const store = docsByCollection || {};
  return {
    collection(name) {
      const docs = Array.isArray(store[name]) ? store[name] : [];
      return {
        limit() {
          return {
            async get() {
              return {
                docs: docs.map((row) => ({
                  id: row.id,
                  data() {
                    return row.data;
                  }
                }))
              };
            }
          };
        },
        doc(id) {
          return {
            async delete() {
              const index = docs.findIndex((row) => row.id === id);
              if (index >= 0) docs.splice(index, 1);
            }
          };
        }
      };
    }
  };
}

test('phase314: retention dry-run emits blocked outcome when policy is undefined', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase314_retention_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/retention-dry-run',
      headers: {
        'x-city-pack-job-token': 'phase314_retention_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase314_retention_dry_run'
      }
    };
    const res = createResponseRecorder();

    await handleRetentionDryRunJob(req, res, JSON.stringify({
      collections: ['canonical_core_outbox']
    }), {
      getDb: () => createDbStub({ canonical_core_outbox: [] }),
      appendAuditLog: async () => null
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'retention_policy_undefined');
    assert.equal(res.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.headers['x-member-outcome-reason'], 'retention_policy_undefined');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});

test('phase314: retention apply emits partial outcome when hasMore remains', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  const prevEnv = process.env.ENV_NAME;
  const prevFlag = process.env.RETENTION_APPLY_ENABLED;
  process.env.CITY_PACK_JOB_TOKEN = 'phase314_retention_token';
  process.env.ENV_NAME = 'stg';
  process.env.RETENTION_APPLY_ENABLED = '1';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/retention-apply',
      headers: {
        'x-city-pack-job-token': 'phase314_retention_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase314_retention_apply'
      }
    };
    const res = createResponseRecorder();

    await handleRetentionApplyJob(req, res, JSON.stringify({
      collections: ['events'],
      cutoffIso: '2026-01-01T00:00:00.000Z',
      maxDeletes: 1
    }), {
      verifyDryRunTrace: async () => ({ ok: true, reason: null }),
      getDb: () => createDbStub({
        events: [
          { id: 'evt_1', data: { createdAt: '2025-01-01T00:00:00.000Z' } },
          { id: 'evt_2', data: { createdAt: '2025-01-02T00:00:00.000Z' } }
        ]
      }),
      appendAuditLog: async () => null
    });

    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_more_remaining');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_more_remaining');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
    if (prevEnv === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnv;
    if (prevFlag === undefined) delete process.env.RETENTION_APPLY_ENABLED;
    else process.env.RETENTION_APPLY_ENABLED = prevFlag;
  }
});
