'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase664: index wiring keeps journey branch dispatch job and admin queue status endpoint', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/internal/jobs/journey-branch-dispatch'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/branch-queue/status'"));
});

test('phase664: internal journey branch dispatch route requires dedicated token guard', () => {
  const src = read('src/routes/internal/journeyBranchDispatchJob.js');
  assert.ok(src.includes("req.headers['x-journey-branch-job-token']"));
  assert.ok(src.includes('JOURNEY_BRANCH_JOB_TOKEN'));
  assert.ok(src.includes('requireJourneyBranchJobToken(req, res)'));
});

test('phase664: monitor pane exposes branch queue controls and admin app fetches queue status endpoint', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="journey-graph-branch-queue-status-filter"'));
  assert.ok(html.includes('id="journey-graph-branch-queue-line-user-id"'));
  assert.ok(html.includes('id="journey-graph-branch-queue-reload"'));
  assert.ok(html.includes('id="journey-graph-branch-queue-rows"'));

  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes('/api/admin/os/journey-graph/branch-queue/status'));
  assert.ok(js.includes('function loadJourneyGraphBranchQueueStatus('));
});
