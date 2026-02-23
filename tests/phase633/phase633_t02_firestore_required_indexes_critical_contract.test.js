'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const REQUIRED_PATH = path.join(process.cwd(), 'docs', 'REPO_AUDIT_INPUTS', 'firestore_required_indexes.json');

function findContract(contracts, contractId) {
  return contracts.find((item) => item && item.contractId === contractId) || null;
}

test('phase633: firestore required indexes defines critical contracts for six admin readiness endpoints', () => {
  const payload = JSON.parse(fs.readFileSync(REQUIRED_PATH, 'utf8'));
  assert.ok(Array.isArray(payload.indexes) && payload.indexes.length >= 7);
  assert.ok(Array.isArray(payload.criticalContracts), 'criticalContracts missing');
  assert.ok(payload.criticalContracts.length >= 6, 'criticalContracts should include six critical routes');

  const ids = new Set(payload.indexes.map((item) => item && item.id).filter(Boolean));
  payload.criticalContracts.forEach((contract) => {
    assert.ok(typeof contract.contractId === 'string' && contract.contractId.length > 0);
    assert.ok(typeof contract.routeOrUsecase === 'string' && contract.routeOrUsecase.length > 0);
    assert.ok(Array.isArray(contract.requiredIndexIds) && contract.requiredIndexIds.length > 0);
    contract.requiredIndexIds.forEach((id) => {
      assert.ok(ids.has(id), `contract ${contract.contractId} references unknown index id ${id}`);
    });
    assert.ok(Array.isArray(contract.sourceEvidence) && contract.sourceEvidence.length > 0);
    contract.sourceEvidence.forEach((evidence) => {
      assert.ok(typeof evidence.path === 'string' && evidence.path.length > 0);
      assert.ok(Number.isInteger(Number(evidence.line)) && Number(evidence.line) > 0);
    });
  });

  const productReadiness = findContract(payload.criticalContracts, 'admin_product_readiness');
  const fallbackSummary = findContract(payload.criticalContracts, 'admin_read_path_fallback_summary');
  const retentionRuns = findContract(payload.criticalContracts, 'admin_retention_runs');
  const structDriftRuns = findContract(payload.criticalContracts, 'admin_struct_drift_backfill_runs');
  const osAlerts = findContract(payload.criticalContracts, 'admin_os_alerts_summary');
  const cityPacks = findContract(payload.criticalContracts, 'admin_city_packs_list');
  assert.ok(productReadiness, 'admin_product_readiness missing');
  assert.ok(fallbackSummary, 'admin_read_path_fallback_summary missing');
  assert.ok(retentionRuns, 'admin_retention_runs missing');
  assert.ok(structDriftRuns, 'admin_struct_drift_backfill_runs missing');
  assert.ok(osAlerts, 'admin_os_alerts_summary missing');
  assert.ok(cityPacks, 'admin_city_packs_list missing');
  assert.ok(osAlerts.requiredIndexIds.includes('audit_logs_action_templateKey_createdAt_desc'));
});
