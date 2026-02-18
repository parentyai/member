'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.resolve(__dirname, '../../.github/workflows/city-pack-source-audit.yml');

test('phase251 t03: workflow exists and calls runner script', () => {
  assert.ok(fs.existsSync(workflowPath));
  const content = fs.readFileSync(workflowPath, 'utf8');

  assert.ok(content.includes('name: City Pack source audit'));
  assert.ok(content.includes('schedule:'));
  assert.ok(content.includes('workflow_dispatch:'));
  assert.ok(content.includes('concurrency:'));
  assert.ok(content.includes('group: city-pack-source-audit'));
  assert.ok(content.includes('node scripts/city_pack_source_audit_runner.js'));
  assert.ok(content.includes('CITY_PACK_JOB_TOKEN'));
  assert.ok(content.includes('city-pack-source-audit-${{ github.run_id }}'));
});
