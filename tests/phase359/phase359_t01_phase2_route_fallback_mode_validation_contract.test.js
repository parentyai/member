'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase359: phase2 automation route validates fallbackMode and forwards it', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/phase2Automation.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("if (fallbackMode && fallbackMode !== 'allow' && fallbackMode !== 'block') {"));
  assert.ok(src.includes("error: 'invalid fallbackMode'"));
  assert.ok(src.includes('fallbackMode: fallbackMode || undefined'));
});

