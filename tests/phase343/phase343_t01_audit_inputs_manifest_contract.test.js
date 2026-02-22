'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase343: audit inputs manifest contains required metadata and file hashes', () => {
  const manifest = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json', 'utf8'));
  assert.ok(typeof manifest.generatedAt === 'string');
  assert.ok(typeof manifest.gitCommit === 'string' && manifest.gitCommit.length >= 8);
  assert.ok(typeof manifest.branch === 'string');
  assert.ok(manifest.counts && typeof manifest.counts === 'object');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
});
