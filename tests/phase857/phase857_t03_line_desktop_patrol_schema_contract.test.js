'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', name), 'utf8'));
}

test('phase857: policy schema keeps hard safety keys required', () => {
  const schema = readSchema('line_desktop_patrol_policy.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.ok(schema.required.includes('enabled'));
  assert.ok(schema.required.includes('dry_run_default'));
  assert.ok(schema.required.includes('allowed_targets'));
  assert.ok(schema.required.includes('auto_apply_level'));
  assert.deepEqual(schema.properties.auto_apply_level.enum, ['none', 'docs_only', 'patch_draft']);
});

test('phase857: trace and proposal schemas include the required evidence anchors', () => {
  const traceSchema = readSchema('line_desktop_patrol_trace.schema.json');
  const proposalSchema = readSchema('line_desktop_patrol_proposal.schema.json');
  assert.ok(traceSchema.required.includes('run_id'));
  assert.ok(traceSchema.required.includes('visible_before'));
  assert.ok(traceSchema.required.includes('proposal_id'));
  assert.ok(proposalSchema.required.includes('proposal_id'));
  assert.ok(proposalSchema.required.includes('source_trace_ids'));
  assert.ok(proposalSchema.required.includes('requires_human_review'));
});

test('phase857: scenario schema keeps timeout and retry contracts explicit', () => {
  const schema = readSchema('line_desktop_patrol_scenario.schema.json');
  assert.ok(schema.required.includes('timeout_budget'));
  assert.ok(schema.required.includes('retry_policy'));
  assert.equal(schema.properties.timeout_budget.additionalProperties, false);
  assert.equal(schema.properties.retry_policy.additionalProperties, false);
});
