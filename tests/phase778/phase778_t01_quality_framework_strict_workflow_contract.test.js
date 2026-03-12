'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('phase778: audit workflow quality-framework job uses strict gate and strict release policy', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'audit.yml');
  const packagePath = path.join(process.cwd(), 'package.json');
  const src = fs.readFileSync(workflowPath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  assert.match(src, /name:\s*quality-framework/);
  assert.match(src, /npm run llm:quality:gate:strict/);
  assert.match(src, /npm run llm:quality:release-policy:strict/);
  assert.match(String(pkg.scripts['llm:quality:gate:strict'] || ''), /LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY=true/);
  assert.match(String(pkg.scripts['llm:quality:release-policy:strict'] || ''), /LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY=true/);
  assert.doesNotMatch(src, /npm run llm:quality:gate\s*\n/);
  assert.doesNotMatch(src, /npm run llm:quality:release-policy\s*\n/);
});
