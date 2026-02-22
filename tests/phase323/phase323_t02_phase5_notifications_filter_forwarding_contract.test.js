'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary', () => {
  const src = fs.readFileSync('/Users/parentyai.com/Projects/Member/src/usecases/phase5/getNotificationsSummaryFiltered.js', 'utf8');
  assert.ok(src.includes('limit: payload.limit'));
  assert.ok(src.includes('eventsLimit: payload.eventsLimit'));
});

