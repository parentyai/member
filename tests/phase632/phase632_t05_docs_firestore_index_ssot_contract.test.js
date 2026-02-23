'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase632: INDEX_REQUIREMENTS binds operational SSOT to firestore_required_indexes definition', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'docs', 'INDEX_REQUIREMENTS.md'), 'utf8');
  assert.ok(src.includes('docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json'));
  assert.ok(src.includes('npm run firestore-indexes:check'));
  assert.ok(src.includes('npm run firestore-indexes:plan'));
});

test('phase632: deploy runbook references firestore-indexes check and required branch protection update', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'docs', 'RUNBOOK_DEPLOY_ENVIRONMENTS.md'), 'utf8');
  assert.ok(src.includes('Firestore Index Drift Guard'));
  assert.ok(src.includes('npm run firestore-indexes:check'));
  assert.ok(src.includes('Branch protection の Required status checks に `firestore-indexes`'));
});

test('phase632: SSOT index references index definition and checker script', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'docs', 'SSOT_INDEX.md'), 'utf8');
  assert.ok(src.includes('docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json'));
  assert.ok(src.includes('scripts/check_firestore_indexes.js'));
});
