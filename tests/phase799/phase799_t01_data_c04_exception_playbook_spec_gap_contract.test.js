'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function readRegistry() {
  const file = path.join(__dirname, '..', '..', 'contracts', 'llm_spec_contract_registry.v2.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('phase799: DATA-C-04 aligns once notification_templates backs exception playbook sidecars', () => {
  const registry = readRegistry();
  const requirement = (registry.requirements || []).find((row) => row.requirementId === 'DATA-C-04');
  assert.ok(requirement, 'DATA-C-04 requirement must exist');
  assert.equal(requirement.status, 'aligned');
  assert.match(String(requirement.summary || ''), /exception playbook/i);
  assert.match(String(requirement.recommendedAction || ''), /notification_templates|typed materializer/i);
  assert.ok((requirement.evidence || []).some((row) => String(row).includes('notificationTemplatesRepo')));
});
