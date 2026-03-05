'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase730: link registry impact route enforces actor + feature flag and builds shared/warn summary', () => {
  const src = read('src/routes/admin/osLinkRegistryImpact.js');
  assert.ok(src.includes('requireActor'));
  assert.ok(src.includes('isLinkRegistryImpactMapEnabled'));
  assert.ok(src.includes("action: 'link_registry.impact.view'"));
  assert.ok(src.includes('sharedIdCount'));
  assert.ok(src.includes('sharedWarnOrDisabledCount'));
  assert.ok(src.includes('referencedWarnOrDisabledCount'));
});

test('phase730: task ux audit internal job route is token-guarded and targets ops_system_snapshot', () => {
  const src = read('src/routes/internal/taskUxAuditJob.js');
  assert.ok(src.includes('requireInternalJobToken'));
  assert.ok(src.includes('isTaskUxAuditKpiEnabled'));
  assert.ok(src.includes("targets: ['ops_system_snapshot']"));
  assert.ok(src.includes("actor: 'task_ux_audit_job'"));
});
