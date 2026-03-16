'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: pane reflection empty-state copy stays pane-specific and dictionary-backed', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  [
    'ui.desc.admin.reflection.defaultNext',
    'ui.desc.admin.reflection.authNext',
    'ui.desc.admin.reflection.warnNext',
    'ui.desc.admin.reflection.errorNext',
    'ui.desc.admin.reflection.successReason',
    'ui.desc.admin.reflection.successNext',
    'ui.desc.admin.reflection.empty.home.reason',
    'ui.desc.admin.reflection.empty.home.next',
    'ui.desc.admin.reflection.empty.monitor.reason',
    'ui.desc.admin.reflection.empty.monitor.next',
    'ui.desc.admin.reflection.empty.cityPack.reason',
    'ui.desc.admin.reflection.empty.cityPack.next',
    'ui.desc.admin.reflection.empty.readModel.reason',
    'ui.desc.admin.reflection.empty.readModel.next',
    'ui.desc.admin.reflection.empty.vendors.reason',
    'ui.desc.admin.reflection.empty.vendors.next'
  ].forEach((key) => {
    assert.ok(dict.includes(`"${key}"`), `${key} missing from ADMIN_UI_DICTIONARY_JA.md`);
  });

  assert.ok(js.includes("reasonKey: 'ui.desc.admin.reflection.empty.home.reason'"));
  assert.ok(js.includes("reasonKey: 'ui.desc.admin.reflection.empty.monitor.reason'"));
  assert.ok(js.includes("reasonKey: 'ui.desc.admin.reflection.empty.cityPack.reason'"));
  assert.ok(js.includes("reasonKey: 'ui.desc.admin.reflection.empty.readModel.reason'"));
  assert.ok(js.includes("reasonKey: 'ui.desc.admin.reflection.empty.vendors.reason'"));
  assert.ok(js.includes("nextEl.textContent = normalizeCopyForRole(vm.next || '-', state.role);"));
});
