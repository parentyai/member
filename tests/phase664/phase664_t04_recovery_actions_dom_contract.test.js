'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: admin app defines local preflight recovery action controls in DOM', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="local-preflight-recheck"'));
  assert.ok(html.includes('id="local-preflight-copy-commands"'));
  assert.ok(html.includes('id="local-preflight-open-audit"'));
  assert.ok(html.includes('id="local-preflight-command-list"'));
  assert.ok(html.includes('id="local-preflight-checks-json"'));
  assert.ok(html.includes('data-local-preflight-field="rawHint"'));
});

test('phase664: admin app wires local preflight recovery action handlers', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('function setupLocalPreflightControls()'));
  assert.ok(src.includes("document.getElementById('local-preflight-recheck')?.addEventListener('click'"));
  assert.ok(src.includes("document.getElementById('local-preflight-copy-commands')?.addEventListener('click'"));
  assert.ok(src.includes("document.getElementById('local-preflight-open-audit')?.addEventListener('click'"));
  assert.ok(src.includes('void rerunLocalPreflightFromUi();'));
  assert.ok(src.includes('void copyLocalPreflightCommands();'));
  assert.ok(src.includes('openLocalPreflightAuditPane();'));
});
