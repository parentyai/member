'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fetchGuardCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: guard normalization maps known errors to cause/impact/action', () => {
  const unauthorized = fetchGuardCore.normalizeGuardError({ error: 'unauthorized' });
  assert.equal(unauthorized.tone, 'danger');
  assert.ok(unauthorized.cause.includes('認証'));
  assert.ok(unauthorized.action.includes('再ログイン'));

  const directUrl = fetchGuardCore.normalizeGuardError({ error: 'direct url blocked' });
  assert.equal(directUrl.tone, 'warn');
  assert.ok(directUrl.cause.includes('直URL'));

  const confirm = fetchGuardCore.normalizeGuardError({ error: 'confirm_token_mismatch' });
  assert.equal(confirm.tone, 'warn');
  assert.ok(confirm.action.includes('最新トークン'));
});
