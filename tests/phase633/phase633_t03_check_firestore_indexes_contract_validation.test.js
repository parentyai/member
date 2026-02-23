'use strict';

const assert = require('assert');
const path = require('path');
const { test } = require('node:test');

const {
  normalizeRequiredIndex,
  normalizeCriticalContract,
  validateCriticalContracts,
  resolveEvidencePath,
  run
} = require('../../scripts/check_firestore_indexes');

test('phase633: validateCriticalContracts detects unknown required index ids', () => {
  const required = [
    normalizeRequiredIndex({
      id: 'audit_logs_action_createdAt_desc',
      collectionGroup: 'audit_logs',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'action', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    })
  ];
  const contract = normalizeCriticalContract({
    contractId: 'admin_product_readiness',
    routeOrUsecase: 'GET /api/admin/product-readiness',
    requiredIndexIds: ['missing_index_id'],
    sourceEvidence: [{ path: '/Users/parentyai.com/Projects/Member/src/index.js', line: 1093 }]
  });
  const errors = validateCriticalContracts(required, [contract]);
  assert.ok(errors.some((item) => item.includes('unknown index id: missing_index_id')));
});

test('phase633: validateCriticalContracts detects unresolved sourceEvidence paths', () => {
  const required = [
    normalizeRequiredIndex({
      id: 'audit_logs_action_createdAt_desc',
      collectionGroup: 'audit_logs',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'action', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    })
  ];
  const contract = normalizeCriticalContract({
    contractId: 'admin_product_readiness',
    routeOrUsecase: 'GET /api/admin/product-readiness',
    requiredIndexIds: ['audit_logs_action_createdAt_desc'],
    sourceEvidence: [{ path: '/Users/parentyai.com/Projects/Member/src/does_not_exist.js', line: 1 }]
  });
  const errors = validateCriticalContracts(required, [contract]);
  assert.ok(errors.some((item) => item.includes('sourceEvidence.path not found')));
});

test('phase633: resolveEvidencePath remaps absolute local repo paths to current workspace', () => {
  const resolved = resolveEvidencePath('/Users/parentyai.com/Projects/Member/src/index.js');
  assert.strictEqual(path.basename(resolved), 'index.js');
});

test('phase633: contracts-only check does not require project id or gcloud calls', () => {
  const execCalls = [];
  const requiredFile = path.join(process.cwd(), 'docs', 'REPO_AUDIT_INPUTS', 'firestore_required_indexes.json');
  const code = run(
    ['node', 'scripts/check_firestore_indexes.js', '--check', '--contracts-only', '--required-file', requiredFile],
    {},
    (cmd, args) => {
      execCalls.push({ cmd, args });
      throw new Error('exec should not be called in contracts-only mode');
    }
  );
  assert.strictEqual(code, 0);
  assert.strictEqual(execCalls.length, 0);
});
