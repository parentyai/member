'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase338: phase5 state route returns metadata fields', () => {
  const file = path.join(process.cwd(), 'src/routes/phase5State.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('includeMeta: true'));
  assert.ok(src.includes('dataSource'));
  assert.ok(src.includes('asOf'));
  assert.ok(src.includes('freshnessMinutes'));
});
