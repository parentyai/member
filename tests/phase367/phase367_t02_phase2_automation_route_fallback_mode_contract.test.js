'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase367: phase2 automation route keeps fallbackMode allow|block contract', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/phase2Automation.js'), 'utf8');
  assert.ok(src.includes("fallbackMode && fallbackMode !== 'allow' && fallbackMode !== 'block'"));
  assert.ok(src.includes("error: 'invalid fallbackMode'"));
});
