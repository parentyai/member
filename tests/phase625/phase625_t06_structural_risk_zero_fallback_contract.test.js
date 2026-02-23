'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: structural risk report marks fallback/full-scan as low when counts are zero', () => {
  const file = path.join(process.cwd(), 'docs/STRUCTURAL_RISK_BEFORE_AFTER.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('| missing-index fallback依存 | high | low |'));
  assert.ok(text.includes('| full-scan常用 | high | low |'));
});

test('phase625: cleanup diff summary records execution-path replacement completion when zero', () => {
  const file = path.join(process.cwd(), 'docs/CLEANUP_DIFF_SUMMARY.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('実行経路置換完了（fallback zero）'));
  assert.ok(text.includes('bounded運用固定（hotspot zero）'));
});
