'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase879: admin v3 shell flags are injected by server and consumed by frontend runtime', () => {
  const server = fs.readFileSync('src/index.js', 'utf8');
  const runtime = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(server.includes('function resolveAdminOpsUiV3Flag()'));
  assert.ok(server.includes('function resolveAdminSystemConsoleV1Flag()'));
  assert.ok(server.includes('function resolveAdminCopyV3Flag()'));
  assert.ok(server.includes('function resolveAdminV3CutoverFlag()'));
  assert.ok(server.includes('function resolveAdminV3KillSwitchFlag()'));
  assert.ok(server.includes('window.ENABLE_ADMIN_OPS_UI_V3='));
  assert.ok(server.includes('window.ENABLE_ADMIN_SYSTEM_CONSOLE_V1='));
  assert.ok(server.includes('window.ENABLE_ADMIN_COPY_V3='));
  assert.ok(server.includes('window.ENABLE_ADMIN_V3_CUTOVER='));
  assert.ok(server.includes('window.ENABLE_ADMIN_V3_KILL_SWITCH='));

  assert.ok(runtime.includes('const ADMIN_OPS_UI_V3 = resolveFrontendFeatureFlag('));
  assert.ok(runtime.includes('const ADMIN_SYSTEM_CONSOLE_V1 = resolveFrontendFeatureFlag('));
  assert.ok(runtime.includes('const ADMIN_COPY_V3 = resolveFrontendFeatureFlag('));
  assert.ok(runtime.includes('const ADMIN_V3_CUTOVER = resolveFrontendFeatureFlag('));
  assert.ok(runtime.includes('const ADMIN_V3_KILL_SWITCH = resolveFrontendFeatureFlag('));
  assert.ok(runtime.includes('const ADMIN_UI_V3_ENABLED = ADMIN_UI_FOUNDATION_V1'));
  assert.ok(runtime.includes("const UI_SHELL_OPS = 'ops';"));
  assert.ok(runtime.includes("const UI_SHELL_SYSTEM = 'system';"));
});
