'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: admin ui dictionary contains local preflight recovery ux keys', () => {
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  [
    'ui.label.admin.localPreflight.recheck',
    'ui.label.admin.localPreflight.copyCommands',
    'ui.label.admin.localPreflight.openAudit',
    'ui.label.admin.localPreflight.commands',
    'ui.label.admin.localPreflight.checks',
    'ui.toast.localPreflight.copyOk',
    'ui.toast.localPreflight.copyFail',
    'ui.toast.localPreflight.copyEmpty',
    'ui.toast.localPreflight.recovered',
    'ui.toast.localPreflight.blockedLoads',
    'ui.value.dashboard.blocked',
    'ui.desc.dashboard.blockedByLocalPreflight'
  ].forEach((key) => {
    assert.ok(dict.includes(`"${key}"`), `dictionary missing key: ${key}`);
  });
});

test('phase664: ssot and runbook mention single banner, degraded mode, and recovery flow', () => {
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');
  const index = fs.readFileSync('docs/SSOT_INDEX.md', 'utf8');

  assert.ok(ssot.includes('checks.firestoreProbe.classification'));
  assert.ok(ssot.includes('checks.saKeyPath'));
  assert.ok(ssot.includes('degraded'));
  assert.ok(ssot.includes('admin-local-preflight-banner'));
  assert.ok(runbook.includes('UI復旧フロー（Phase664）'));
  assert.ok(runbook.includes('コマンドコピー'));
  assert.ok(index.includes('local preflight recovery UX'));
});
