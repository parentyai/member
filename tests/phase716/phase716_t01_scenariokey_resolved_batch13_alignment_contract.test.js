'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const REQUIRED_RESOLVED_BATCH13 = Object.freeze([
  'src/usecases/notifications/sendNotification.js',
  'src/usecases/notifications/sendNotificationPhase1.js'
]);

test('phase716: resolved scenarioKey lock includes batch13 paths and current drift excludes them', () => {
  const allowlist = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/scenario_key_drift_allowlist.json', 'utf8'));
  const designMeta = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/design_ai_meta.json', 'utf8'));

  const resolved = Array.isArray(allowlist && allowlist.resolved && allowlist.resolved.scenarioKey)
    ? allowlist.resolved.scenarioKey
    : [];
  const current = Array.isArray(designMeta && designMeta.naming_drift && designMeta.naming_drift.scenarioKey)
    ? designMeta.naming_drift.scenarioKey
    : [];

  REQUIRED_RESOLVED_BATCH13.forEach((file) => {
    assert.equal(resolved.includes(file), true, `resolved path missing: ${file}`);
    assert.equal(current.includes(file), false, `resolved path reintroduced in current drift: ${file}`);
  });
});
