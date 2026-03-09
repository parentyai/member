'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase751: quality docs include rubric and audit artifacts', () => {
  const audit = fs.readFileSync(path.join(ROOT, 'docs', 'LLM_QUALITY_REPO_AUDIT_V1.md'), 'utf8');
  const human = fs.readFileSync(path.join(ROOT, 'docs', 'LLM_QUALITY_HUMAN_EVAL_RUBRIC_V1.md'), 'utf8');
  const auto = fs.readFileSync(path.join(ROOT, 'docs', 'LLM_QUALITY_AUTO_EVAL_RUBRIC_V1.md'), 'utf8');
  assert.match(audit, /current_quality_risk_map/);
  assert.match(audit, /top_10_quality_failures/);
  assert.match(human, /Dimension Rubric/);
  assert.match(auto, /Hard Gate Conditions/);
});

test('phase751: PR template enforces quality scorecard disclosure fields', () => {
  const tpl = fs.readFileSync(path.join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8');
  assert.match(tpl, /Current Baseline Scorecard/);
  assert.match(tpl, /Expected Post-change Scorecard/);
  assert.match(tpl, /Hard Gate Impact/);
  assert.match(tpl, /Quality Risks/);
  assert.match(tpl, /What Improves \/ What Might Regress/);
});
