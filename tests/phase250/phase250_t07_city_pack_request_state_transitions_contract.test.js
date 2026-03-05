'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const { runCityPackDraftJob } = require('../../src/usecases/cityPack/runCityPackDraftJob');

test('phase250: draft job fatal error writes failed state with trace evidence', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  const originalCreateSourceRef = sourceRefsRepo.createSourceRef;

  try {
    await cityPackRequestsRepo.createRequest({
      id: 'cpr_phase250_failed_001',
      status: 'queued',
      lineUserId: 'U_PHASE250_001',
      regionKey: 'ny::new-york',
      traceId: 'trace_phase250_failed_001',
      draftSourceCandidates: ['https://example.com/source']
    });

    sourceRefsRepo.createSourceRef = async () => {
      const err = new Error('source_ref_create_failed');
      err.code = 'E_SOURCE_REF_CREATE';
      throw err;
    };

    const result = await runCityPackDraftJob({
      requestId: 'cpr_phase250_failed_001',
      traceId: 'trace_phase250_failed_001',
      actor: 'phase250_t07'
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'draft_job_failed');
    assert.strictEqual(result.errorCode, 'E_SOURCE_REF_CREATE');
    assert.strictEqual(result.traceId, 'trace_phase250_failed_001');

    const request = await cityPackRequestsRepo.getRequest('cpr_phase250_failed_001');
    assert.strictEqual(request.status, 'failed');
    assert.strictEqual(request.traceId, 'trace_phase250_failed_001');
    assert.strictEqual(request.errorCode, 'E_SOURCE_REF_CREATE');
    assert.strictEqual(request.errorMessage, 'source_ref_create_failed');
    assert.ok(typeof request.failedAt === 'string' && request.failedAt.length > 0);

    const audits = await auditLogsRepo.listAuditLogsByTraceId('trace_phase250_failed_001', 50);
    const failedAudit = audits.find((row) => row.action === 'city_pack.request.draft.failed');
    assert.ok(failedAudit);
    assert.strictEqual(failedAudit.entityId, 'cpr_phase250_failed_001');
    assert.strictEqual(failedAudit.payloadSummary.errorCode, 'E_SOURCE_REF_CREATE');
    assert.strictEqual(failedAudit.payloadSummary.errorMessage, 'source_ref_create_failed');
  } finally {
    sourceRefsRepo.createSourceRef = originalCreateSourceRef;
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase250: state_transitions SSOT and generator include city_pack_request lifecycle writers', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const transitionsPath = path.join(repoRoot, 'docs/REPO_AUDIT_INPUTS/state_transitions.json');
  const generatorPath = path.join(repoRoot, 'scripts/generate_audit_core_maps.js');
  const transitions = JSON.parse(fs.readFileSync(transitionsPath, 'utf8'));
  const list = transitions.city_pack_request && Array.isArray(transitions.city_pack_request.transitions)
    ? transitions.city_pack_request.transitions
    : [];

  function hasTransition(from, to, writerIncludes) {
    return list.some((row) => {
      if (!row || row.from !== from || row.to !== to) return false;
      const writer = typeof row.writer === 'string' ? row.writer : '';
      return writer.includes(writerIncludes);
    });
  }

  assert.ok(hasTransition('*', 'queued', 'declareCityRegionFromLine.js'));
  assert.ok(hasTransition('*', 'collecting', 'runCityPackDraftJob.js'));
  assert.ok(hasTransition('collecting', 'drafted', 'runCityPackDraftJob.js'));
  assert.ok(hasTransition('collecting', 'needs_review', 'runCityPackDraftJob.js'));
  assert.ok(hasTransition('collecting', 'failed', 'runCityPackDraftJob.js'));
  assert.ok(hasTransition('*', 'approved', 'cityPackRequests.js'));
  assert.ok(hasTransition('*', 'rejected', 'cityPackRequests.js'));
  assert.ok(hasTransition('*', 'needs_review', 'cityPackRequests.js'));
  assert.ok(hasTransition('approved', 'active', 'activateCityPack.js'));

  const generatorText = fs.readFileSync(generatorPath, 'utf8');
  assert.ok(generatorText.includes("from: '*',\n          to: 'collecting'"));
  assert.ok(generatorText.includes("from: 'collecting',\n          to: 'failed'"));
  assert.ok(generatorText.includes("from: '*',\n          to: 'approved'"));
});
