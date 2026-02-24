'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase653: index wiring includes journey reminder internal route and journey policy admin APIs', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/internal/jobs/journey-todo-reminder'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-policy/status'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-policy/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-policy/set'"));
});

test('phase653: webhook line path includes postback journey handler', () => {
  const src = read('src/routes/webhookLine.js');
  assert.ok(src.includes("event && event.type === 'postback'"));
  assert.ok(src.includes('handleJourneyPostback'));
  assert.ok(src.includes('postbackData'));
});

test('phase653: firestore required indexes include journey todo read paths and contracts', () => {
  const payload = JSON.parse(read('docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json'));
  const indexIds = new Set((payload.indexes || []).map((item) => item && item.id).filter(Boolean));
  assert.ok(indexIds.has('journey_todo_items_status_nextReminderAt_asc'));
  assert.ok(indexIds.has('journey_todo_items_lineUserId_updatedAt_desc'));
  assert.ok(indexIds.has('journey_todo_items_lineUserId_status_updatedAt_desc'));

  const contracts = payload.criticalContracts || [];
  const reminderContract = contracts.find((item) => item && item.contractId === 'internal_journey_todo_reminder_job');
  const billingDetailJourney = contracts.find((item) => item && item.contractId === 'admin_os_user_billing_detail_journey');
  assert.ok(reminderContract, 'internal_journey_todo_reminder_job contract missing');
  assert.ok(billingDetailJourney, 'admin_os_user_billing_detail_journey contract missing');
  assert.ok(reminderContract.requiredIndexIds.includes('journey_todo_items_status_nextReminderAt_asc'));
  assert.ok(billingDetailJourney.requiredIndexIds.includes('journey_todo_items_lineUserId_updatedAt_desc'));
});

test('phase653: journey reminder workflow invokes internal job with token header', () => {
  const workflow = read('.github/workflows/journey-todo-reminder.yml');
  assert.ok(workflow.includes('/internal/jobs/journey-todo-reminder'));
  assert.ok(workflow.includes('x-journey-job-token'));
  assert.ok(workflow.includes('JOURNEY_JOB_TOKEN'));
});
