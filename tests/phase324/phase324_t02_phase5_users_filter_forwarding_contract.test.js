'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase324: users filtered usecase forwards limit/analyticsLimit to operational summary', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUsersSummaryFiltered.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('limit: payload.limit'));
  assert.ok(src.includes('analyticsLimit: payload.analyticsLimit'));
});

