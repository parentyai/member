'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateChecklistCompleteness } = require('../../src/usecases/phase24/checklistCompleteness');

test('phase24 t05: progress without definition => BLOCK', () => {
  const result = evaluateChecklistCompleteness({ totalItems: 0 }, { completedCount: 1 });
  assert.strictEqual(result.completeness.ok, false);
  assert.ok(result.completeness.missing.includes('progress_without_definition'));
  assert.strictEqual(result.completeness.severity, 'BLOCK');
});

test('phase24 t05: missing required item => BLOCK', () => {
  const result = evaluateChecklistCompleteness({ totalItems: 2 }, { completedCount: 1 });
  assert.strictEqual(result.completeness.ok, false);
  assert.ok(result.completeness.missing.includes('missing_required_item'));
  assert.strictEqual(result.completeness.severity, 'BLOCK');
});

test('phase24 t05: completed but incomplete => BLOCK', () => {
  const result = evaluateChecklistCompleteness({ totalItems: 2 }, { completedCount: 1, completed: true });
  assert.strictEqual(result.completeness.ok, false);
  assert.ok(result.completeness.missing.includes('completed_but_incomplete'));
  assert.strictEqual(result.completeness.severity, 'BLOCK');
});

test('phase24 t05: required satisfied => ok and complete', () => {
  const result = evaluateChecklistCompleteness({ totalItems: 2 }, { completedCount: 2 });
  assert.strictEqual(result.completeness.ok, true);
  assert.deepStrictEqual(result.completeness.missing, []);
  assert.strictEqual(result.completion.isComplete, true);
});
