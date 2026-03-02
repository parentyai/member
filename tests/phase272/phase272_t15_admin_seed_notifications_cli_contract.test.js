'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: package.json exposes admin:seed-notifications script', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(pkg && pkg.scripts);
  assert.strictEqual(pkg.scripts['admin:seed-notifications'], 'node tools/admin_seed_notifications.js');
});

test('phase272: admin seed notifications cli supports create/apply/archive over admin notification APIs', () => {
  const src = readFileSync('tools/admin_seed_notifications.js', 'utf8');
  assert.ok(src.includes("'--count-per-type'"));
  assert.ok(src.includes("'--apply'"));
  assert.ok(src.includes("'--archive'"));
  assert.ok(src.includes("'--dry-run'"));
  assert.ok(src.includes("'--target-region'"));
  assert.ok(src.includes("'--scenario-period-count'"));
  assert.ok(src.includes("'--types'"));
  assert.ok(src.includes('SEED_NOTIFICATIONS_REGION'));
  assert.ok(src.includes('SEED_NOTIFICATIONS_SCENARIO_PERIOD_COUNT'));
  assert.ok(src.includes('SEED_NOTIFICATIONS_TYPES'));
  assert.ok(src.includes("DEFAULT_TARGET_REGION = 'nyc'"));
  assert.ok(src.includes('dummyDependencyLabel'));
  assert.ok(src.includes('dummyDependsOnStep'));
  assert.ok(src.includes('dummyDependsOnOrder'));
  assert.ok(src.includes('/api/admin/os/notifications/draft'));
  assert.ok(src.includes('/api/admin/os/notifications/approve'));
  assert.ok(src.includes('/api/admin/os/notifications/send/plan'));
  assert.ok(src.includes('/api/admin/os/notifications/send/execute'));
  assert.ok(src.includes('/api/admin/os/notifications/seed/archive'));
  assert.ok(src.includes('DEFAULT_ARTIFACT_DIR'));
});
