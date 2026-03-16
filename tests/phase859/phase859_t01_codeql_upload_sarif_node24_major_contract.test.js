'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('phase859: audit workflow uses codeql upload-sarif v4 (node24 runtime)', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'audit.yml');
  const src = fs.readFileSync(workflowPath, 'utf8');

  assert.ok(!src.includes('github/codeql-action/upload-sarif@v3'));
  assert.ok(src.includes('github/codeql-action/upload-sarif@v4'));
  assert.ok(src.includes('name: Upload Semgrep SARIF'));
  assert.ok(src.includes('sarif_file: artifacts/audit/semgrep.sarif'));
});
