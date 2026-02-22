'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase580: docs artifacts generator orchestrates all required artifact scripts', () => {
  const file = path.join(process.cwd(), 'scripts/generate_docs_artifacts.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("script: path.join('scripts', 'generate_repo_map.js')"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_audit_inputs_manifest.js')"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_supervisor_master.js')"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_load_risk.js')"));
  assert.ok(src.includes("script: path.join('scripts', 'generate_cleanup_reports.js')"));
  assert.ok(src.includes("runNodeScript(path.join('scripts', 'check_structural_cleanup.js'), []);"));
});

test('phase580: docs artifacts check script delegates to generator --check mode', () => {
  const file = path.join(process.cwd(), 'scripts/check_docs_artifacts.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("path.join('scripts', 'generate_docs_artifacts.js'), '--check'"));
});

