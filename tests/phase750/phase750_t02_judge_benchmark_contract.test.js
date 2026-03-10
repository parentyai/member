'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { summarize } = require('../../tools/llm_quality/judge_calibration');
const { validateManifest } = require('../../tools/llm_quality/benchmark_registry');
const { evaluateRisk } = require('../../tools/llm_quality/contamination_guard');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase750: judge calibration dataset keeps minimum 120 cases and computes reliability summary', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/llm_quality/fixtures/human_adjudication_set.v1.json'), 'utf8'));
  const summary = summarize(rows);
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 120);
  assert.ok(summary.disagreementRate <= 0.15);
  assert.ok(summary.promptSensitivityDrift <= 0.1);
});

test('phase750: benchmark registry is frozen and contamination guard excludes high-risk fixture from hard gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/registry/manifest.v1.json'), 'utf8'));
  const validation = validateManifest(manifest);
  assert.equal(validation.ok, true);
  assert.equal(validation.frozen, true);

  const contamination = evaluateRisk(manifest);
  assert.equal(contamination.overall, 'high');
  assert.equal(contamination.hardGateOverall, 'medium');
  assert.ok(contamination.excludedFixtureIds.includes('open_web_scrape_probe'));
  assert.ok(!contamination.hardGateEligibleFixtureIds.includes('open_web_scrape_probe'));
});
