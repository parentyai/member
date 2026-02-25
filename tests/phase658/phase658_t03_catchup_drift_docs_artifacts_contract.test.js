'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase658: catchup drift gate includes docs artifacts check', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(typeof pkg.scripts['catchup:drift-check'] === 'string');
  assert.ok(pkg.scripts['catchup:drift-check'].includes('docs-artifacts:check'));
});

test('phase658: PR template reflects docs-artifacts in catchup drift checklist', () => {
  const text = fs.readFileSync('.github/PULL_REQUEST_TEMPLATE.md', 'utf8');
  assert.ok(text.includes('repo-map / docs-artifacts / cleanup / retention / structure / load-risk / missing-index'));
});
