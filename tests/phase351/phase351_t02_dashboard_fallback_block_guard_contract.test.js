'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;"));
  assert.ok(src.includes('if (users.length === 0) {'));
  assert.ok(
    src.includes('if (!fallbackBlocked) {') ||
      src.includes('if (!fallbackBlocked && fallbackOnEmpty) {')
  );
  assert.ok(src.includes("fallbackSources.push('listAllUsers');"));
  assert.ok(src.includes("fallbackSources.push('listAllNotifications');"));
  assert.ok(src.includes('fallbackBlockedNotAvailable = true;'));
  assert.ok(src.includes("dataSource: computed.fallbackBlocked ? 'not_available' : 'computed'"));
});
