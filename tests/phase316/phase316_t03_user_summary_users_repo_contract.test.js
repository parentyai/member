'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase316: user operational summary sources users from canonical usersRepo listUsers', () => {
  const src = readFileSync('src/usecases/admin/getUserOperationalSummary.js', 'utf8');
  assert.ok(src.includes("const usersRepo = require('../../repos/firestore/usersRepo');"));
  assert.ok(src.includes('usersRepo.listUsers({ limit: analyticsLimit })'));
});
