'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase793: DATA-C-01 contract status is partial with canonical core bridge evidence', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-01');
  assert.ok(requirement, 'DATA-C-01 requirement must exist');
  assert.equal(requirement.status, 'partial');
  assert.match(
    String(requirement.recommendedAction || ''),
    /dual-write|canonical core outbox|postgres/i,
    'DATA-C-01 action must mention bridge/dual-write progression'
  );
});

test('phase793: CF-02 remains blocking until canonical core PostgreSQL sink is implemented', () => {
  const registry = readRegistry();
  const conflict = (registry.conflicts || []).find((row) => row.conflictId === 'CF-02');
  assert.ok(conflict, 'CF-02 conflict must exist');
  assert.equal(conflict.blocking, true);
});
