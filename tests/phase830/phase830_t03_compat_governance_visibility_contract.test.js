'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const read = (filePath) => fs.readFileSync(path.join(ROOT, filePath), 'utf8');

test('phase830: compat routes and sinks expose compat governance visibility', () => {
  const compat2 = read('src/routes/phaseLLM2OpsExplain.js');
  const compat3 = read('src/routes/phaseLLM3OpsNextActions.js');
  const compat4 = read('src/routes/phaseLLM4FaqAnswer.js');
  const gateWriter = read('src/usecases/llm/appendLlmGateDecision.js');
  const actionRepo = read('src/repos/firestore/llmActionLogsRepo.js');
  const adminJs = read('apps/admin/assets/admin_app.js');

  assert.ok(compat2.includes("compatFallbackReason: 'legacy_compat_ops_explain'"));
  assert.ok(compat3.includes("compatFallbackReason: 'legacy_compat_ops_next_actions'"));
  assert.ok(compat4.includes("compatFallbackReason: 'legacy_compat_faq_answer'"));
  assert.ok(gateWriter.includes('compatFallbackReason'));
  assert.ok(actionRepo.includes('compatFallbackReason'));
  assert.ok(adminJs.includes('compatFallbackReason'));
  assert.ok(adminJs.includes('compat fallback で取得しました'));
});
