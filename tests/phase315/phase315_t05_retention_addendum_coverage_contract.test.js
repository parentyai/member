'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');
const { listRetentionPolicies } = require('../../src/domain/retention/retentionPolicy');

const addendum = fs.readFileSync('docs/SSOT_RETENTION_ADDENDUM.md', 'utf8');
const lifecycle = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/data_lifecycle.json', 'utf8'));

test('phase315: retention addendum and lifecycle cover all retention policy collections', () => {
  const fromLifecycle = new Set(lifecycle.map((row) => row.collection));
  listRetentionPolicies().forEach((policy) => {
    const marker = `| \`${policy.collection}\` |`;
    assert.ok(addendum.includes(marker), `SSOT_RETENTION_ADDENDUM missing collection row: ${policy.collection}`);
    assert.ok(fromLifecycle.has(policy.collection), `data_lifecycle.json missing collection: ${policy.collection}`);
  });
});
