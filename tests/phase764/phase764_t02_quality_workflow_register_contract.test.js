'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase764: audit workflow quality job runs report and uploads failure register artifacts', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'audit.yml'), 'utf8');
  assert.match(workflow, /npm run llm:quality:report/);
  assert.match(workflow, /tmp\/llm_quality_report\.json/);
  assert.match(workflow, /tmp\/llm_quality_failure_register\.json/);
  assert.match(workflow, /tmp\/llm_quality_counterexample_queue\.json/);
});
