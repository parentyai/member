'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { getRetentionPolicy } = require('../../src/domain/retention/retentionPolicy');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase846: registry collections are present in retention and data map docs', () => {
  const issuePolicy = getRetentionPolicy('quality_issue_registry');
  const backlogPolicy = getRetentionPolicy('quality_improvement_backlog');
  assert.equal(issuePolicy.kind, 'config');
  assert.equal(issuePolicy.retentionDays, 'INDEFINITE');
  assert.equal(backlogPolicy.kind, 'config');
  assert.equal(backlogPolicy.retentionDays, 'INDEFINITE');

  const dataMap = read('docs/DATA_MAP.md');
  assert.match(dataMap, /quality_issue_registry/);
  assert.match(dataMap, /quality_improvement_backlog/);

  const runbook = read('docs/QUALITY_PATROL_REGISTRY_RUNBOOK.md');
  assert.match(runbook, /quality_issue_registry/);
  assert.match(runbook, /quality_improvement_backlog/);
  assert.match(runbook, /no runtime webhook\/orchestrator caller in PR-1/);

  const retention = read('docs/SSOT_RETENTION.md');
  assert.match(retention, /\| quality_issue_registry \| config \| INDEFINITE \| NO \| NO \|/);
  assert.match(retention, /\| quality_improvement_backlog \| config \| INDEFINITE \| NO \| NO \|/);
});
