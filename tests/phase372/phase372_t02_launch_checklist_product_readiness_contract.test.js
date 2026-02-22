'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase372: launch checklist includes product-readiness API checks', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/LAUNCH_CHECKLIST.md'), 'utf8');
  assert.ok(text.includes('/api/admin/product-readiness'));
  assert.ok(text.includes('GO / NO_GO'));
});
