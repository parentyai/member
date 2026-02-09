'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase127: docs exist with reaction definitions', () => {
  const doc = readFileSync('docs/SSOT_LINE_ONLY_DELTA.md', 'utf8');
  assert.ok(doc.includes('# SSOT_LINE_ONLY_DELTA'));
  assert.ok(doc.includes('Reaction Definitions'));
  assert.ok(doc.includes('click'));
  assert.ok(doc.includes('read'));
  assert.ok(doc.includes('open'));
  assert.ok(doc.includes('lastReactionAt'));
});

