'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const REQUIRED_TARGETS = Object.freeze([
  'src/repos/firestore/indexFallbackPolicy.js',
  'src/shared/phaseDocPathResolver.js'
]);

function parseFinalizedTargetRow(text, file) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\|\\s*\\\`${escaped}\\\`\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm');
  const match = text.match(re);
  if (!match) return null;
  return {
    status: String(match[1] || '').trim(),
    reachability: String(match[2] || '').trim(),
    disposition: String(match[3] || '').trim()
  };
}

test('phase703: unreachable classification and finalization SSOT align on required targets', () => {
  const classification = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/unreachable_classification.json', 'utf8'));
  const byFile = new Map((classification.items || []).map((row) => [row.file, row]));
  const ssot = fs.readFileSync('docs/SSOT_UNREACHABLE_FINALIZATION_V1.md', 'utf8');

  REQUIRED_TARGETS.forEach((file) => {
    const row = byFile.get(file);
    assert.ok(row, `missing classification row for ${file}`);
    const ssotRow = parseFinalizedTargetRow(ssot, file);
    assert.ok(ssotRow, `missing finalization table row for ${file}`);
    assert.equal(ssotRow.status, row.status, `status mismatch: ${file}`);
    assert.equal(ssotRow.reachability, row.reachability, `reachability mismatch: ${file}`);
    assert.equal(ssotRow.disposition, row.disposition, `disposition mismatch: ${file}`);
  });
});
