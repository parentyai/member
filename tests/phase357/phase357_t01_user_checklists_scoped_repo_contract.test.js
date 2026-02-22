'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase357: analytics read repo exposes lineUserIds scoped user_checklists query', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/analyticsReadRepo.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('async function listUserChecklistsByLineUserIds(opts)'));
  assert.ok(src.includes(".collection('user_checklists')"));
  assert.ok(src.includes(".where('lineUserId', '==', lineUserId)"));
  assert.ok(src.includes('listUserChecklistsByLineUserIds,'));
});

