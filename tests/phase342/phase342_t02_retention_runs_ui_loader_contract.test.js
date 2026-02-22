'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase342: admin app loads retention runs from admin API', () => {
  const file = path.join(process.cwd(), 'apps/admin/assets/admin_app.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('/api/admin/retention-runs?'));
  assert.ok(src.includes('function loadRetentionRuns'));
  assert.ok(src.includes('setupMaintenanceControls'));
});
