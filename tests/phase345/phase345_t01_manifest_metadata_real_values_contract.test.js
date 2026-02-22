'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase345: audit inputs manifest uses real metadata values', () => {
  const manifest = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json', 'utf8'));
  assert.ok(typeof manifest.generatedAt === 'string');
  assert.notStrictEqual(manifest.generatedAt, 'NOT AVAILABLE');
  assert.ok(typeof manifest.gitCommit === 'string' && /^[0-9a-f]{40}$/.test(manifest.gitCommit));
  assert.ok(typeof manifest.branch === 'string');
  assert.notStrictEqual(manifest.branch, 'NOT_AVAILABLE');
  assert.ok(typeof manifest.sourceDigest === 'string' && manifest.sourceDigest.length === 64);
});
