'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const LEDGER_DOC = 'docs/UI_SCREENSHOT_EVIDENCE_LEDGER_V2.md';
const LEDGER_JSON = 'ui_screenshot_evidence_index_v2.json';

test('phase674: screenshot evidence ledger docs and json artifacts exist', () => {
  assert.equal(fs.existsSync(LEDGER_DOC), true, 'ledger markdown is required');
  assert.equal(fs.existsSync(LEDGER_JSON), true, 'ledger json is required');
});

test('phase674: screenshot evidence ledger json keeps minimum schema and source file links', () => {
  const rows = JSON.parse(fs.readFileSync(LEDGER_JSON, 'utf8'));

  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 20, 'expected at least 20 screenshot evidence rows');

  const requiredKeys = [
    'evidenceId',
    'captureSet',
    'observedAt',
    'sourceLog',
    'filePath',
    'surfaceId',
    'role',
    'viewport',
    'observed'
  ];

  rows.forEach((row, idx) => {
    requiredKeys.forEach((key) => {
      assert.ok(Object.prototype.hasOwnProperty.call(row, key), `row ${idx} missing ${key}`);
    });
    assert.match(row.evidenceId, /^SSEV-\d{4}$/);
    assert.equal(row.observed, true);
    assert.equal(typeof row.filePath, 'string');
    assert.equal(typeof row.sourceLog, 'string');
    assert.ok(row.filePath.startsWith('artifacts/'));
    assert.ok(row.filePath.endsWith('.png'));
    assert.ok(row.sourceLog.startsWith('artifacts/'));
    assert.ok(row.sourceLog.endsWith('.log') || row.sourceLog.endsWith('.txt'));
  });
});

test('phase674: screenshot evidence ledger covers key capture sets, roles and priority surfaces', () => {
  const rows = JSON.parse(fs.readFileSync(LEDGER_JSON, 'utf8'));

  const captureSets = new Set(rows.map((row) => row.captureSet));
  assert.ok(captureSets.has('ui-audit-20260306'));
  assert.ok(captureSets.has('ui-ux-audit-20260307'));

  const roles = new Set(rows.map((row) => row.role));
  assert.ok(roles.has('admin'));
  assert.ok(roles.has('operator'));
  assert.ok(roles.has('developer'));

  const surfaces = new Set(rows.map((row) => row.surfaceId));
  ['UI-ADM-HOME', 'UI-ADM-COMPOSER', 'UI-ADM-MONITOR', 'UI-ADM-CITY-PACK', 'UI-ADM-VENDORS'].forEach((surfaceId) => {
    assert.ok(surfaces.has(surfaceId), `missing priority surface evidence: ${surfaceId}`);
  });
});
