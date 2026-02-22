'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase331: phase5 notifications filtered usecase forwards snapshotMode', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getNotificationsSummaryFiltered.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('snapshotMode: payload.snapshotMode'));
});
