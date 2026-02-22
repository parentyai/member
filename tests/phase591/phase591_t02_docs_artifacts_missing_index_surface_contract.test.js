'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase591: docs artifacts orchestrator includes missing-index-surface generator', () => {
  const file = path.join(process.cwd(), 'scripts/generate_docs_artifacts.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("label: 'missing-index-surface'"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_missing_index_surface.js')"));
});

test('phase591: missing index surface artifact is included in audit inputs manifest file list', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json'), 'utf8'));
  const files = Array.isArray(manifest && manifest.files) ? manifest.files.map((row) => row.file) : [];
  assert.ok(files.includes('docs/REPO_AUDIT_INPUTS/missing_index_surface.json'));
});
