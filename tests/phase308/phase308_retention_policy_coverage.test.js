'use strict';

const assert = require('assert');
const { test } = require('node:test');

const lifecycle = require('../../docs/REPO_AUDIT_INPUTS/data_lifecycle.json');
const { listRetentionPolicies, getRetentionPolicy } = require('../../src/domain/retention/retentionPolicy');

test('phase308: retention policy covers all collections from audit lifecycle snapshot', () => {
  const fromAudit = new Set(lifecycle.map((row) => row.collection));
  const fromPolicy = new Set(listRetentionPolicies().map((row) => row.collection));

  for (const collection of fromAudit) {
    assert.ok(fromPolicy.has(collection), `retention policy missing collection: ${collection}`);
    const resolved = getRetentionPolicy(collection);
    assert.ok(resolved && resolved.defined === true, `retention policy unresolved for: ${collection}`);
  }
});
