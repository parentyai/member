'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(path.resolve(__dirname, '../../', filePath), 'utf8');
}

test('phase747: docs declare task detail observability and funnel contracts', () => {
  const ssotIndex = read('docs/SSOT_INDEX.md');
  const foundation = read('docs/SSOT_UX_OS_FOUNDATION_V1.md');
  const runbook = read('docs/RUNBOOK_OPS.md');
  const observability = read('docs/TASK_DETAIL_OBSERVABILITY_V1.md');
  const funnel = read('docs/JOURNEY_FUNNEL_EVENT_CONTRACT_V1.md');

  assert.ok(ssotIndex.includes('docs/TASK_DETAIL_OBSERVABILITY_V1.md'));
  assert.ok(ssotIndex.includes('docs/JOURNEY_FUNNEL_EVENT_CONTRACT_V1.md'));
  assert.ok(foundation.includes('Addendum: Task Detail Observability (Phase747)'));
  assert.ok(runbook.includes('Phase747 Task Detail Observability運用'));
  assert.ok(observability.includes('todo_detail_opened'));
  assert.ok(observability.includes('deliveryToDetailToDoneRate'));
  assert.ok(funnel.includes('deliveryToDetailToDoneRate'));
});
