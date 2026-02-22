'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getNotificationsSummaryFiltered.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('limit: payload.limit'));
  assert.ok(src.includes('eventsLimit: payload.eventsLimit'));
});
