'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: SSOT index includes structure budgets entry', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/SSOT_INDEX.md'), 'utf8');
  assert.ok(text.includes('docs/STRUCTURE_BUDGETS.md'));
});
