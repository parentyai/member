'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('phase778: audit workflow quality-framework job uses strict gate and strict release policy', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'audit.yml');
  const packagePath = path.join(process.cwd(), 'package.json');
  const ssotPath = path.join(process.cwd(), 'docs', 'SSOT_LLM_QUALITY_FRAMEWORK_V1.md');
  const loopPath = path.join(process.cwd(), 'docs', 'LLM_QUALITY_LOOP_V2.md');
  const runbookPath = path.join(process.cwd(), 'docs', 'LLM_RUNBOOK.md');
  const src = fs.readFileSync(workflowPath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const ssot = fs.readFileSync(ssotPath, 'utf8');
  const loop = fs.readFileSync(loopPath, 'utf8');
  const runbook = fs.readFileSync(runbookPath, 'utf8');

  assert.match(src, /name:\s*quality-framework/);
  assert.match(src, /npm run llm:quality:gate:strict/);
  assert.match(src, /npm run llm:quality:release-policy:strict/);
  assert.match(String(pkg.scripts['llm:quality:gate:strict'] || ''), /LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY=true/);
  assert.match(String(pkg.scripts['llm:quality:release-policy:strict'] || ''), /LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY=true/);
  assert.doesNotMatch(src, /npm run llm:quality:gate\s*\n/);
  assert.doesNotMatch(src, /npm run llm:quality:release-policy\s*\n/);
  assert.match(src, /tmp\/llm_quality_runs\/\*\*/);
  assert.match(ssot, /ResponseQualityContext/);
  assert.match(ssot, /QualityRunManifest/);
  assert.match(ssot, /tmp\/llm_quality_runs\/<runId>/);
  assert.match(loop, /Shared Response-Quality Foundation/);
  assert.match(loop, /run-scoped artifacts are primary/);
  assert.match(runbook, /run-scoped quality artifacts/);
});
