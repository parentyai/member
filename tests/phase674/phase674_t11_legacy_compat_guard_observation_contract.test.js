'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: legacy compat observation keeps role+confirm guard and logs compat reason', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const routesDoc = fs.readFileSync('docs/SSOT_ADMIN_UI_ROUTES_V2.md', 'utf8');

  assert.ok(indexSrc.includes("const compatRaw = String(url.searchParams.get('compat') || '').trim();"));
  assert.ok(indexSrc.includes("const stayLegacyRaw = String(url.searchParams.get('stay_legacy') || '').trim();"));
  assert.ok(indexSrc.includes("state.requested = compatRaw === '1' || stayLegacyRaw === '1';"));

  assert.ok(indexSrc.includes("if (role !== 'admin' && role !== 'developer') {"));
  assert.ok(indexSrc.includes('const expectedConfirm = resolveAdminUiCompatConfirmToken();'));
  assert.ok(indexSrc.includes('timingSafeEqualString(providedConfirm, expectedConfirm)'));

  assert.ok(indexSrc.includes('compatRole: compatState.role'));
  assert.ok(indexSrc.includes('compatReason: compatState.reason'));

  assert.ok(routesDoc.includes('role=admin|developer'));
  assert.ok(routesDoc.includes('confirm=<ADMIN_UI_COMPAT_CONFIRM_TOKEN>'));
});

