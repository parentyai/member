'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { handleQualityPatrolQuery } = require('../../src/routes/admin/qualityPatrol');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk || '';
    }
  };
}

test('phase861: quality patrol route returns nested desktop patrol summary and audit fields add-only', async () => {
  const auditCalls = [];
  const req = {
    method: 'GET',
    url: '/api/admin/quality-patrol?mode=latest&audience=operator',
    headers: {
      'x-actor': 'phase861_tester',
      'x-trace-id': 'trace_phase861_route'
    }
  };
  const res = createResponseRecorder();

  await handleQualityPatrolQuery(req, res, {
    queryLatestPatrolInsights: async () => ({
      ok: true,
      mode: 'latest',
      audience: 'operator',
      summary: {
        overallStatus: 'ready',
        topPriorityCount: 1,
        observationBlockerCount: 0
      },
      observationStatus: 'ready'
    }),
    queryLatestDesktopPatrolSummary: async () => ({
      ok: true,
      status: 'ready',
      stage: 'queued',
      queue: { totalCount: 2, latestProposalId: 'prop_002', packetCount: 2 }
    }),
    appendAuditLog: async (payload) => {
      auditCalls.push(payload);
    }
  });

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.desktopPatrolSummary.status, 'ready');
  assert.equal(payload.desktopPatrolSummary.stage, 'queued');
  assert.equal(payload.desktopPatrolSummary.queue.totalCount, 2);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolStatus, 'ready');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolQueueCount, 2);
});
