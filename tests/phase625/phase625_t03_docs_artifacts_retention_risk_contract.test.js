'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: docs artifacts orchestrator includes retention-risk generator', () => {
  const file = path.join(process.cwd(), 'scripts/generate_docs_artifacts.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("label: 'retention-risk'"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_retention_risk.js')"));
});

test('phase625: audit inputs manifest includes retention_risk artifact', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json'), 'utf8')
  );
  const files = Array.isArray(manifest && manifest.files) ? manifest.files.map((row) => row.file) : [];
  assert.ok(files.includes('docs/REPO_AUDIT_INPUTS/retention_risk.json'));
});
