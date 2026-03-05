'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase730: SSOT task detail section defines taskKey policy and safety valve', () => {
  const ssot = read('docs/SSOT_TASK_ENGINE_V1.md');
  assert.ok(ssot.includes('解決規約（固定）'));
  assert.ok(ssot.includes('TODO詳細続き:{todoKey}:{manual|failure}:{startChunk}'));
  assert.ok(ssot.includes('ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1'));
  assert.ok(ssot.includes('TASK_DETAIL_SECTION_CHUNK_LIMIT'));
});

test('phase730: runbook includes stg checklist and evidence template', () => {
  const runbook = read('docs/RUNBOOK_OPS.md');
  assert.ok(runbook.includes('stg実機検証手順（再現用）'));
  assert.ok(runbook.includes('Case A: manual短文'));
  assert.ok(runbook.includes('Case F: postback payload破損'));
  assert.ok(runbook.includes('stg証跡テンプレート（実施時に追記）'));
  assert.ok(runbook.includes('編集責務（混同防止）'));
  assert.ok(runbook.includes('`task-rules` | Task Engine / Step Rules'));
});
