'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase669: index wires emergency admin/internal routes', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/emergency/providers'"));
  assert.ok(src.includes("/^\\/api\\/admin\\/emergency\\/providers\\/[^/]+$/.test(pathname)"));
  assert.ok(src.includes("pathname === '/api/admin/emergency/bulletins'"));
  assert.ok(src.includes("/^\\/api\\/admin\\/emergency\\/bulletins\\/[^/]+$/.test(pathname)"));
  assert.ok(src.includes("pathname === '/internal/jobs/emergency-sync'"));
  assert.ok(src.includes("pathname === '/internal/jobs/emergency-provider-fetch'"));
  assert.ok(src.includes("pathname === '/internal/jobs/emergency-provider-normalize'"));
  assert.ok(src.includes("pathname === '/internal/jobs/emergency-provider-summarize'"));
  assert.ok(src.includes('handleEmergencyLayer'));
  assert.ok(src.includes('handleEmergencyJobs'));
});

test('phase669: emergency workflow runs every 10 minutes and calls runner with job token', () => {
  const workflow = fs.readFileSync('.github/workflows/emergency-layer-sync.yml', 'utf8');
  const runner = fs.readFileSync('scripts/emergency_sync_runner.js', 'utf8');
  assert.ok(workflow.includes('cron: "*/10 * * * *"'));
  assert.ok(workflow.includes('CITY_PACK_JOB_TOKEN'));
  assert.ok(workflow.includes('node scripts/emergency_sync_runner.js'));
  assert.ok(runner.includes('x-city-pack-job-token'));
});
