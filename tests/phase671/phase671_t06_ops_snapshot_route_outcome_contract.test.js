'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleOpsSnapshotJob } = require('../../src/routes/internal/opsSnapshotJob');

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

test('phase671: ops snapshot route emits partial outcome when targets are skipped', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase671_snapshot_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/ops-snapshot-build',
      headers: {
        'x-city-pack-job-token': 'phase671_snapshot_token',
        'content-type': 'application/json; charset=utf-8'
      }
    };
    const res = createResponseRecorder();

    await handleOpsSnapshotJob(req, res, '{}', {
      getKillSwitch: async () => false,
      buildOpsSnapshots: async () => ({
        ok: true,
        summary: {
          dryRun: false,
          snapshotsBuilt: 2,
          skippedTargets: ['ops_system_snapshot']
        },
        items: []
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_skips');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_skips');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
